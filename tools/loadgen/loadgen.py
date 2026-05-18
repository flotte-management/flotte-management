import argparse
import json
import os
import random
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import requests
from faker import Faker


@dataclass
class Config:
    gateway_url: str
    vehicle_service_url: str
    driver_service_url: str
    maintenance_service_url: str
    mission_service_url: str
    location_service_url: str
    keycloak_url: str
    keycloak_realm: str
    keycloak_client_id: str
    keycloak_client_secret: str | None
    keycloak_username: str | None
    keycloak_password: str | None
    api_token: str | None
    min_delay: float
    max_delay: float
    read_rate: float
    business_rate: float
    position_rate: float
    error_rate: float
    request_timeout: float
    log_every: int


@dataclass
class TokenState:
    token: str | None = None
    expires_at: float = 0.0


class LoadState:
    def __init__(self) -> None:
        self.vehicle_ids: list[str] = []
        self.driver_ids: list[str] = []
        self.mission_ids: list[str] = []
        self.last_refresh: float = 0.0


def env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def env_float(name: str, default: float) -> float:
    value = env(name)
    return float(value) if value is not None else default


def env_int(name: str, default: int) -> int:
    value = env(name)
    return int(value) if value is not None else default


def make_config() -> Config:
    return Config(
        gateway_url=env("GATEWAY_URL", "http://localhost:4000/graphql") or "",
        vehicle_service_url=env("VEHICLE_SERVICE_URL", "http://localhost:8081") or "",
        driver_service_url=env("DRIVER_SERVICE_URL", "http://localhost:8000") or "",
        maintenance_service_url=env("MAINTENANCE_SERVICE_URL", "http://localhost:8001") or "",
        mission_service_url=env("MISSION_SERVICE_URL", "http://localhost:3005") or "",
        location_service_url=env("LOCATION_SERVICE_URL", "http://localhost:3003") or "",
        keycloak_url=env("KEYCLOAK_URL", "http://localhost:8080") or "",
        keycloak_realm=env("KEYCLOAK_REALM", "flotte-management") or "",
        keycloak_client_id=env("KEYCLOAK_CLIENT_ID", "flotte-frontend") or "",
        keycloak_client_secret=env("KEYCLOAK_CLIENT_SECRET"),
        keycloak_username=env("KEYCLOAK_USERNAME"),
        keycloak_password=env("KEYCLOAK_PASSWORD"),
        api_token=env("API_TOKEN"),
        min_delay=env_float("MIN_DELAY_SEC", 0.2),
        max_delay=env_float("MAX_DELAY_SEC", 1.5),
        read_rate=env_float("READ_RATE", 0.55),
        business_rate=env_float("BUSINESS_RATE", 0.25),
        position_rate=env_float("POSITION_RATE", 0.2),
        error_rate=env_float("ERROR_RATE", 0.08),
        request_timeout=env_float("REQUEST_TIMEOUT_SEC", 5.0),
        log_every=env_int("LOG_EVERY", 25),
    )


def keycloak_token(config: Config) -> tuple[str, float]:
    url = (
        f"{config.keycloak_url}/realms/{config.keycloak_realm}"
        "/protocol/openid-connect/token"
    )
    data = {
        "grant_type": "password",
        "client_id": config.keycloak_client_id,
        "username": config.keycloak_username,
        "password": config.keycloak_password,
    }
    if config.keycloak_client_secret:
        data["client_secret"] = config.keycloak_client_secret

    resp = requests.post(url, data=data, timeout=config.request_timeout)
    resp.raise_for_status()
    payload = resp.json()
    expires_in = int(payload.get("expires_in", 300))
    return payload["access_token"], time.time() + max(60, expires_in - 30)


def auth_headers(token_state: TokenState) -> dict[str, str]:
    if not token_state.token:
        return {}
    return {"Authorization": f"Bearer {token_state.token}"}


def request_json(
    method: str,
    url: str,
    token_state: TokenState,
    payload: dict | None = None,
    timeout: float = 5.0,
) -> requests.Response:
    headers = {"Content-Type": "application/json", **auth_headers(token_state)}
    return requests.request(
        method,
        url,
        headers=headers,
        data=json.dumps(payload) if payload is not None else None,
        timeout=timeout,
    )


def graphql_request(
    config: Config,
    token_state: TokenState,
    query: str,
    variables: dict | None = None,
) -> tuple[int, dict | None]:
    payload = {"query": query, "variables": variables or {}}
    resp = request_json("POST", config.gateway_url, token_state, payload, config.request_timeout)
    try:
        data = resp.json()
    except json.JSONDecodeError:
        data = None
    return resp.status_code, data


def refresh_token(config: Config, token_state: TokenState) -> None:
    if config.api_token:
        token_state.token = config.api_token
        token_state.expires_at = time.time() + 3600
        return
    if not config.keycloak_username or not config.keycloak_password:
        return
    if token_state.token and time.time() < token_state.expires_at:
        return
    token, expires_at = keycloak_token(config)
    token_state.token = token
    token_state.expires_at = expires_at


def refresh_cache(config: Config, token_state: TokenState, state: LoadState) -> None:
    if time.time() - state.last_refresh < 60:
        return

    queries = {
        "vehicules": "query($limit:Int){ vehicules(limit:$limit){ id } }",
        "conducteurs": "query($limit:Int){ conducteurs(limit:$limit){ id } }",
        "missions": "query($limit:Int){ missions(limit:$limit){ id } }",
    }
    for key, query in queries.items():
        status, data = graphql_request(config, token_state, query, {"limit": 50})
        items = []
        if status < 400 and data and data.get("data"):
            items = [item["id"] for item in data["data"].get(key, []) if item.get("id")]
        if key == "vehicules" and items:
            state.vehicle_ids = items
        if key == "conducteurs" and items:
            state.driver_ids = items
        if key == "missions" and items:
            state.mission_ids = items

    state.last_refresh = time.time()


def ensure_vehicle(config: Config, token_state: TokenState, state: LoadState, faker: Faker) -> str | None:
    if state.vehicle_ids:
        return random.choice(state.vehicle_ids)

    create_vehicle = (
        "mutation($input: CreateVehiculeInput!){ "
        "creerVehicule(input:$input){ id statut } }"
    )
    payload = {
        "immatriculation": f"{faker.random_uppercase_letter()}{faker.random_uppercase_letter()}-"
        f"{faker.random_number(digits=3, fix_len=True)}-"
        f"{faker.random_uppercase_letter()}{faker.random_uppercase_letter()}",
        "marque": faker.company(),
        "modele": faker.word(),
        "annee": random.randint(2016, 2025),
        "typeCarburant": random.choice(["ESSENCE", "DIESEL", "ELECTRIQUE", "HYBRIDE"]),
        "typeVehicule": random.choice(["utilitaire", "berline", "camion"]),
        "kilometrage": float(random.randint(1000, 180000)),
        "capaciteCharge": float(random.randint(200, 3000)),
        "consommationMoyenne": float(random.randint(4, 12)),
        "notes": "seeded-by-loadgen",
    }
    status, data = graphql_request(config, token_state, create_vehicle, {"input": payload})

    # Sécurisation du `.get` pour éviter l'erreur NoneType
    if status < 400 and data and (data.get("data") or {}).get("creerVehicule"):
        vehicle_id = data["data"]["creerVehicule"]["id"]
        state.vehicle_ids.append(vehicle_id)
        return vehicle_id
    elif data and data.get("errors"):
        print(f"[loadgen] Erreur création véhicule : {data['errors']}")
    return None


def ensure_driver(config: Config, token_state: TokenState, state: LoadState, faker: Faker) -> str | None:
    if state.driver_ids:
        return random.choice(state.driver_ids)

    create_driver = (
        "mutation($input: CreateConducteurInput!){ "
        "creerConducteur(input:$input){ id statut } }"
    )
    payload = {
        "nom": faker.last_name(),
        "prenom": faker.first_name(),
        "email": faker.unique.email(),
        "telephone": faker.phone_number(),
    }
    status, data = graphql_request(config, token_state, create_driver, {"input": payload})

    # Sécurisation du `.get` pour éviter l'erreur NoneType
    if status < 400 and data and (data.get("data") or {}).get("creerConducteur"):
        driver_id = data["data"]["creerConducteur"]["id"]
        state.driver_ids.append(driver_id)
        return driver_id
    elif data and data.get("errors"):
        print(f"[loadgen] Erreur création conducteur : {data['errors']}")
    return None


def create_mission(config: Config, token_state: TokenState, state: LoadState, faker: Faker) -> None:
    vehicle_id = ensure_vehicle(config, token_state, state, faker)
    driver_id = ensure_driver(config, token_state, state, faker)
    if not vehicle_id or not driver_id:
        return

    now = datetime.now(timezone.utc)
    start = now + timedelta(minutes=random.randint(5, 60))
    end = start + timedelta(minutes=random.randint(20, 180))

    mutation = (
        "mutation($input: CreateMissionInput!){ "
        "creerMission(input:$input){ id statut } }"
    )
    payload = {
        "titre": f"Mission {faker.city()} -> {faker.city()}",
        "description": "loadgen mission",
        "vehiculeId": vehicle_id,
        "conducteurId": driver_id,
        "dateDebut": start.isoformat(),
        "dateFin": end.isoformat(),
        "adresseDepart": faker.address().replace("\n", ", "),
        "adresseDestination": faker.address().replace("\n", ", "),
        "distanceEstimeeKm": float(random.randint(5, 300)),
        "notes": "auto-generated",
    }
    status, data = graphql_request(config, token_state, mutation, {"input": payload})

    # Sécurisation du `.get` pour éviter l'erreur NoneType
    if status < 400 and data and data.get("data", {}).get("creerMission"):
        mission_id = data["data"]["creerMission"]["id"]
        state.mission_ids.append(mission_id)


def create_maintenance(config: Config, token_state: TokenState, state: LoadState, faker: Faker) -> None:
    vehicle_id = ensure_vehicle(config, token_state, state, faker)
    if not vehicle_id:
        return

    mutation = (
        "mutation($input: CreateMaintenanceInput!){ "
        "creerMaintenance(input:$input){ id statut } }"
    )
    payload = {
        "vehiculeId": vehicle_id,
        "typeMaintenance": random.choice(["PREVENTIVE", "CORRECTIVE", "URGENCE", "REVISION"]),
        "description": "maintenance loadgen",
        "dateDebut": datetime.now(timezone.utc).isoformat(),
        "notes": faker.sentence(nb_words=6),
    }
    graphql_request(config, token_state, mutation, {"input": payload})


def change_vehicle_status(config: Config, token_state: TokenState, vehicle_id: str) -> None:
    mutation = (
        "mutation($id:ID!, $input: ChangeStatutVehiculeInput!){ "
        "changerStatutVehicule(id:$id, input:$input){ id statut } }"
    )
    payload = {
        "statut": random.choice([
            "DISPONIBLE",
            "EN_MISSION",
            "EN_MAINTENANCE",
            "HORS_SERVICE",
        ]),
        "motif": "loadgen",
    }
    graphql_request(config, token_state, mutation, {"id": vehicle_id, "input": payload})


def change_driver_status(config: Config, token_state: TokenState, driver_id: str) -> None:
    mutation = (
        "mutation($id:ID!, $statut: StatutConducteur!){ "
        "changerStatutConducteur(id:$id, statut:$statut){ id statut } }"
    )
    graphql_request(
        config,
        token_state,
        mutation,
        {"id": driver_id, "statut": random.choice(["ACTIF", "EN_MISSION", "EN_CONGE"])}
    )


def push_position(config: Config, token_state: TokenState, vehicle_id: str) -> None:
    base_lat = 48.8566
    base_lon = 2.3522
    jitter_lat = random.uniform(-0.02, 0.02)
    jitter_lon = random.uniform(-0.02, 0.02)
    payload = {
        "vehiculeId": vehicle_id,
        "latitude": base_lat + jitter_lat,
        "longitude": base_lon + jitter_lon,
        "vitesse": float(random.randint(0, 120)),
        "cap": float(random.randint(0, 359)),
        "precision": float(random.randint(1, 12)),
        "time": datetime.now(timezone.utc).isoformat(),
        "correlationId": str(uuid.uuid4()),
    }
    # Les positions géographiques sont souvent ingérées directement par un service spécifique (ex: Kafka/UDP),
    # mais si cela passe en HTTP, on le laisse taper le location service ou la gateway selon votre archi.
    request_json(
        "POST",
        f"{config.location_service_url}/localisation/positions",
        token_state,
        payload,
        config.request_timeout,
    )


def read_traffic(config: Config, token_state: TokenState, state: LoadState) -> None:
    # Modification : On utilise GraphQL via la Gateway pour que Grafana capte le trafic HTTP entrant
    queries = [
        "query($limit:Int){ vehicules(limit:$limit){ id marque modele statut } }",
        "query($limit:Int){ conducteurs(limit:$limit){ id nom prenom statut } }",
        "query($limit:Int){ missions(limit:$limit){ id statut distanceEstimeeKm } }"
    ]
    query = random.choice(queries)
    graphql_request(config, token_state, query, {"limit": 20})


def read_dashboard(config: Config, token_state: TokenState) -> None:
    query = (
        "query { dashboardFlotte { totalVehicules vehiculesDisponibles "
        "vehiculesEnMission vehiculesEnMaintenance vehiculesHorsService "
        "totalConducteurs conducteursActifs conducteursEnMission missionsEnCours "
        "maintenancesEnCours } }"
    )
    graphql_request(config, token_state, query, None)


def generate_4xx(config: Config, token_state: TokenState) -> None:
    # Modification : On tape une route inexistante sur la Gateway au lieu d'un microservice interne
    bad_url = config.gateway_url.replace("/graphql", "/api/route-inexistante")
    request_json("GET", bad_url, token_state, None, config.request_timeout)


def generate_5xx(config: Config, token_state: TokenState, vehicle_id: str | None, driver_id: str | None) -> None:
    # Modification : On envoie une requête invalide à la Gateway pour générer une erreur
    if not vehicle_id or not driver_id:
        return

    mutation = (
        "mutation($input: CreateMissionInput!){ "
        "creerMission(input:$input){ id statut } }"
    )
    payload = {
        "titre": "Bad mission",
        "vehiculeId": vehicle_id,
        "conducteurId": driver_id,
        # Dates invalides ou formats incorrects pour forcer une erreur serveur
        "dateDebut": "not-a-valid-date",
        "dateFin": "not-a-valid-date",
    }
    graphql_request(config, token_state, mutation, {"input": payload})


def main() -> None:
    parser = argparse.ArgumentParser(description="Local load generator for fleet APIs")
    parser.add_argument("--once", action="store_true", help="Run a single iteration")
    parser.add_argument("--iterations", type=int, default=0, help="Run N iterations and exit")
    args = parser.parse_args()

    config = make_config()
    token_state = TokenState()
    state = LoadState()
    faker = Faker("fr_FR")

    counts = {"total": 0, "ok": 0, "4xx": 0, "5xx": 0, "err": 0}

    if not config.api_token and not (config.keycloak_username and config.keycloak_password):
        print("[loadgen] warning: no API_TOKEN or KEYCLOAK credentials; requests may be 401")

    iterations = args.iterations if args.iterations > 0 else None

    while True:
        refresh_token(config, token_state)
        refresh_cache(config, token_state, state)

        roll = random.random()
        if roll < config.error_rate:
            try:
                generate_4xx(config, token_state)
                generate_5xx(config, token_state, ensure_vehicle(config, token_state, state, faker), ensure_driver(config, token_state, state, faker))
            except requests.RequestException:
                counts["err"] += 1
        elif roll < config.error_rate + config.position_rate:
            vehicle_id = ensure_vehicle(config, token_state, state, faker)
            if vehicle_id:
                try:
                    push_position(config, token_state, vehicle_id)
                except requests.RequestException:
                    counts["err"] += 1
        elif roll < config.error_rate + config.position_rate + config.business_rate:
            try:
                action = random.choice(["mission", "maintenance", "veh_statut", "drv_statut"])
                if action == "mission":
                    create_mission(config, token_state, state, faker)
                elif action == "maintenance":
                    create_maintenance(config, token_state, state, faker)
                elif action == "veh_statut":
                    vehicle_id = ensure_vehicle(config, token_state, state, faker)
                    if vehicle_id:
                        change_vehicle_status(config, token_state, vehicle_id)
                else:
                    driver_id = ensure_driver(config, token_state, state, faker)
                    if driver_id:
                        change_driver_status(config, token_state, driver_id)
            except requests.RequestException:
                counts["err"] += 1
        else:
            try:
                if random.random() < 0.3:
                    read_dashboard(config, token_state)
                else:
                    read_traffic(config, token_state, state)
            except requests.RequestException:
                counts["err"] += 1

        counts["total"] += 1
        delay = random.uniform(config.min_delay, config.max_delay)
        if args.once:
            break
        if iterations is not None and counts["total"] >= iterations:
            break
        time.sleep(delay)

        if config.log_every and counts["total"] % config.log_every == 0:
            print(f"[loadgen] total={counts['total']} err={counts['err']}")


if __name__ == "__main__":
    main()