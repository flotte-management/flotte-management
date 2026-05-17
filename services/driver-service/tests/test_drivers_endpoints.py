import uuid
from datetime import date, datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import drivers as drivers_endpoints
from app.api.v1.router import api_router
from app.core.security import TokenPayload, get_current_user
from app.models.driver import Assignation, Driver, Permis, StatutDriver


class FakeRepo:
    def __init__(self) -> None:
        self.driver = _make_driver()
        self.permis = _make_permis(self.driver.id)
        self.assignation = _make_assignation(self.driver.id)
        self.email_taken = False
        self.get_by_id_result = self.driver
        self.update_statut_result = self.driver
        self.active_assignation = False
        self.deleted = False

    async def get_by_email(self, email: str):
        return self.driver if self.email_taken else None

    async def create(self, payload):
        for field, value in payload.model_dump().items():
            setattr(self.driver, field, value)
        return self.driver

    async def get_all(self, skip: int = 0, limit: int = 20, statut=None):
        return [self.driver], 1

    async def get_by_id(self, driver_id: uuid.UUID):
        return self.get_by_id_result

    async def update(self, driver: Driver, payload):
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(driver, field, value)
        return driver

    async def update_statut(self, driver_id: uuid.UUID, statut: StatutDriver):
        if self.update_statut_result is None:
            return None
        self.driver.statut = statut
        return self.driver

    async def delete(self, driver: Driver) -> None:
        self.deleted = True

    async def get_active_assignation(self, driver_id: uuid.UUID):
        return self.assignation if self.active_assignation else None

    async def create_assignation(self, driver_id: uuid.UUID, payload):
        self.assignation = _make_assignation(driver_id, payload.vehicule_id)
        return self.assignation


def _make_driver() -> Driver:
    driver = Driver(
        id=uuid.uuid4(),
        nom="Dupont",
        prenom="Jean",
        email="jean.dupont@example.com",
        telephone="0102030405",
        statut=StatutDriver.actif,
        date_naissance=date(1990, 1, 1),
    )
    driver.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    driver.updated_at = datetime(2024, 1, 2, tzinfo=timezone.utc)
    driver.permis = []
    driver.assignations = []
    return driver


def _make_permis(driver_id: uuid.UUID) -> Permis:
    permis = Permis(
        id=uuid.uuid4(),
        driver_id=driver_id,
        categorie="B",
        numero="PERMIS-123",
        date_delivrance=date(2020, 1, 1),
        date_expiration=date(2030, 1, 1),
    )
    return permis


def _make_assignation(driver_id: uuid.UUID, vehicule_id: uuid.UUID | None = None) -> Assignation:
    assignation = Assignation(
        id=uuid.uuid4(),
        driver_id=driver_id,
        vehicule_id=vehicule_id or uuid.uuid4(),
        date_debut=datetime(2024, 1, 10, tzinfo=timezone.utc),
        date_fin=None,
        statut="active",
    )
    return assignation


def _make_app(repo: FakeRepo, roles: list[str]) -> FastAPI:
    app = FastAPI()
    app.include_router(api_router)

    async def fake_user() -> TokenPayload:
        user = TokenPayload({"sub": "test-user", "email": "test@example.com"})
        user.roles = roles
        return user

    app.dependency_overrides[drivers_endpoints._repo] = lambda: repo
    app.dependency_overrides[get_current_user] = fake_user
    return app


def _client(repo: FakeRepo, roles: list[str]) -> TestClient:
    app = _make_app(repo, roles)
    return TestClient(app)


def test_create_driver_conflict():
    repo = FakeRepo()
    repo.email_taken = True
    client = _client(repo, ["ADMIN"])

    payload = {
        "nom": "Doe",
        "prenom": "Jane",
        "email": "jane.doe@example.com",
        "telephone": "0101010101",
        "statut": "actif",
        "date_naissance": "1992-02-02",
    }

    response = client.post("/api/v1/drivers", json=payload)
    assert response.status_code == 409


def test_create_driver_success_emits(monkeypatch):
    repo = FakeRepo()
    client = _client(repo, ["ADMIN"])
    called = {}

    async def fake_emit(driver_id: str, data: dict):
        called["driver_id"] = driver_id
        called["data"] = data

    monkeypatch.setattr(
        drivers_endpoints.kafka, "emit_driver_created", fake_emit
    )

    payload = {
        "nom": "Doe",
        "prenom": "Jane",
        "email": "jane.doe@example.com",
        "telephone": "0101010101",
        "statut": "actif",
        "date_naissance": "1992-02-02",
    }

    response = client.post("/api/v1/drivers", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "jane.doe@example.com"
    assert called["driver_id"] == str(repo.driver.id)


def test_list_drivers_pagination():
    repo = FakeRepo()
    client = _client(repo, ["USER"])

    response = client.get("/api/v1/drivers?page=1&size=10")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["size"] == 10
    assert body["items"][0]["email"] == repo.driver.email


def test_get_driver_not_found():
    repo = FakeRepo()
    repo.get_by_id_result = None
    client = _client(repo, ["USER"])

    response = client.get(f"/api/v1/drivers/{uuid.uuid4()}")
    assert response.status_code == 404


def test_update_driver_email_conflict():
    repo = FakeRepo()
    repo.email_taken = True
    client = _client(repo, ["ADMIN"])

    payload = {"email": "duplicate@example.com"}
    response = client.put(f"/api/v1/drivers/{repo.driver.id}", json=payload)
    assert response.status_code == 409


def test_update_statut_not_found():
    repo = FakeRepo()
    repo.update_statut_result = None
    client = _client(repo, ["ADMIN"])

    payload = {"statut": "inactif"}
    response = client.patch(f"/api/v1/drivers/{repo.driver.id}/statut", json=payload)
    assert response.status_code == 404


def test_create_assignation_inactive_driver():
    repo = FakeRepo()
    repo.driver.statut = StatutDriver.inactif
    client = _client(repo, ["TECHNICIEN"])

    payload = {
        "vehicule_id": str(uuid.uuid4()),
        "date_debut": "2024-02-01T10:00:00Z",
        "date_fin": None,
        "statut": "active",
    }

    response = client.post(
        f"/api/v1/drivers/{repo.driver.id}/assignations",
        json=payload,
    )
    assert response.status_code == 422


def test_create_assignation_already_active():
    repo = FakeRepo()
    repo.active_assignation = True
    client = _client(repo, ["MANAGER"])

    payload = {
        "vehicule_id": str(uuid.uuid4()),
        "date_debut": "2024-02-01T10:00:00Z",
        "date_fin": None,
        "statut": "active",
    }

    response = client.post(
        f"/api/v1/drivers/{repo.driver.id}/assignations",
        json=payload,
    )
    assert response.status_code == 409


def test_create_assignation_success_emits(monkeypatch):
    repo = FakeRepo()
    client = _client(repo, ["ADMIN"])
    called = {}

    async def fake_emit(driver_id: str, vehicule_id: str, assignation_id: str):
        called["driver_id"] = driver_id
        called["vehicule_id"] = vehicule_id
        called["assignation_id"] = assignation_id

    monkeypatch.setattr(
        drivers_endpoints.kafka, "emit_driver_assigned", fake_emit
    )

    payload = {
        "vehicule_id": str(uuid.uuid4()),
        "date_debut": "2024-02-01T10:00:00Z",
        "date_fin": None,
        "statut": "active",
    }

    response = client.post(
        f"/api/v1/drivers/{repo.driver.id}/assignations",
        json=payload,
    )
    assert response.status_code == 201
    assert called["driver_id"] == str(repo.driver.id)

