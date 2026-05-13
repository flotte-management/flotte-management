# Resume des changements Observabilite

## 1) OpenTelemetry Collector
- Ajout de `otel-collector-config.yaml` avec :
  - Recepteurs OTLP (gRPC 4317, HTTP 4318).
  - Recepteur Prometheus qui scrape `/metrics` des services.
  - Processors : `batch`, `memory_limiter`.
  - Exporters : `otlp/jaeger`, `prometheus` (port 8889), `debug`.
  - Pipelines pour traces et metrics.

## 2) Alignement OTLP dans Docker Compose
- protocole OTLP en gRPC pour les services exportant vers `otel-collector:4317` :
  - `vehicle-service`, `driver-service`, `maintenance-service`, `mission-service`, `location-service`, `event-service`.
  - Ajout de `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`.

## 3) Scraping Prometheus
- Mise a jour de `monotoring/prometheus/prometheus.yml` pour scraper :
  - `otel-collector:8889` et tous les endpoints `/metrics` des services.

## 4) Dashboards Grafana
- Mise a jour de `monotoring/grafana/provisioning/dashboards/business-metrics.json` avec :
  - Uptime des services, trafic, erreurs, latence.
  - Panels metiers pour missions et maintenances.
  - Jauges pour conducteurs et vehicules.

## 5) Service maintenance (FastAPI)
- Ajout des metriques Prometheus et de l'endpoint `/metrics` :
  - Fichier : `services/maintenance-service/app/metrics.py`.
  - Expose `/metrics` dans `services/maintenance-service/app/main.py`.
  - Instrumentation des endpoints dans `services/maintenance-service/app/api/v1/endpoints/maintenances.py`.
  - Ajout de `prometheus-client` dans `services/maintenance-service/requirements.txt`.
- Metriques produites :
  - `fleet_maintenances_created_total`
  - `fleet_maintenances_deleted_total`
  - `fleet_maintenances_status_changed_total{status=...}`
  - `fleet_maintenances_pieces_added_total`
  - `fleet_maintenances_pieces_removed_total`

## 6) Service mission (NestJS)
- Ajout de l'endpoint Prometheus `/metrics` :
  - `services/mission-service/src/metrics/metrics.controller.ts`.
  - Enregistre dans `services/mission-service/src/app.module.ts`.
- Ajout des metriques mission :
  - `services/mission-service/src/metrics/mission.metrics.ts`.
  - Instrumente dans `services/mission-service/src/missions/missions.service.ts`.
  - Ajout de `prom-client` dans `services/mission-service/package.json`.
- Metriques produites :
  - `fleet_missions_created_total`
  - `fleet_missions_deleted_total`
  - `fleet_missions_status_changed_total{status=...}`
  - `fleet_missions_started_total`
  - `fleet_missions_completed_total`
  - `fleet_missions_cancelled_total`
  - `fleet_mission_etapes_added_total`
  - `fleet_mission_etapes_updated_total`

## 7) Service driver (FastAPI)
- Ajout d'une jauge Prometheus pour les conducteurs actifs et de l'endpoint `/metrics` :
  - `services/driver-service/app/metrics.py` avec `fleet_drivers_active`.
  - `services/driver-service/app/main.py` met a jour la jauge via le comptage DB.
  - `services/driver-service/app/repositories/driver_repository.py` ajoute `count_by_statut`.
  - Ajout de `prometheus-client` dans `services/driver-service/requirements.txt`.

## 8) Service vehicle (Spring Boot)
- Ajout d'Actuator + registry Prometheus :
  - `services/vehicle-service/pom.xml`.
- Ajout d'une jauge pour les vehicules actifs :
  - `services/vehicle-service/src/main/java/com/fleet/vehicule/metrics/VehicleMetrics.java`.
  - `services/vehicle-service/src/main/java/com/fleet/vehicule/repository/VehiculeRepository.java` ajoute `countByStatut`.
- Exposition des metriques sur `/metrics` :
  - `services/vehicle-service/src/main/resources/application.yml` avec mapping des endpoints.
- Metrique produite :
  - `fleet_vehicles_active` (vehicules avec `StatutVehicule.EN_SERVICE`).

