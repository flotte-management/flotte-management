# Location Service

NestJS microservice for fleet localisation with:

- GPS position ingestion
- latest position and history lookup
- geofencing zones and alerts
- TimescaleDB + PostGIS support
- gRPC server-side streaming for live positions
- pluggable Kafka event publication
- optional AI-style vehicle analysis endpoint

This implementation is intentionally production-shaped but still lightweight enough for a university lab.

## Main Endpoints

### REST

- `GET /health`
- `POST /localisation/positions`
- `GET /localisation/:id/position`
- `GET /localisation/:id/historique?from=2026-04-01T00:00:00Z&to=2026-04-03T23:59:59Z`
- `GET /localisation/zones`
- `POST /localisation/zones`
- `PUT /localisation/zones/:id`
- `DELETE /localisation/zones/:id`
- `GET /localisation/alertes?page=1&limit=20&vehiculeId=VH-001&typeAlerte=ENTER`
- `GET /localisation/:id/analyse?from=2026-04-02T00:00:00Z&to=2026-04-03T00:00:00Z`

### gRPC

- Proto file: `src/proto/location.proto`
- Service: `location.v1.LocationStreamingService`
- Method: `StreamVehiclePositions`
- Port: `3001` inside Docker, exposed as `3004` by `docker-compose.yml`

## Environment Variables

Required database variables:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Optional variables:

- `PORT` default `3000`
- `GRPC_PORT` default `3001`
- `DB_AUTO_BOOTSTRAP` default `true`
- `DB_ALLOW_START_WITHOUT_DATABASE` default `false`
- `KAFKA_ENABLED` default `false`
- `KAFKA_BROKERS` comma-separated list
- `KAFKA_CLIENT_ID` default `location-service`
- `KAFKA_TOPIC` default `location-domain-events`
- `AI_AGENT_ENABLED` default `true`

## Database Notes

The service expects a PostgreSQL database with both:

- `TimescaleDB`
- `PostGIS`

`docker-compose.yml` now uses a Timescale image for `postgres-location`, and the folder `db/init/` is mounted into `docker-entrypoint-initdb.d`.

Bootstrap strategy:

1. Container init script enables `postgis` and `timescaledb`
2. NestJS startup creates tables and indexes if missing
3. NestJS startup converts `positions_gps` into a hypertable if needed

Important:

- If the `postgres-location` volume already exists from an older plain PostgreSQL image, recreate it before first use.
- Typical command: `docker compose down -v` then `docker compose up --build`

## Data Model

### `positions_gps`

- timestamp column: `time`
- vehicle identifier: `vehicule_id`
- raw coordinates: `latitude`, `longitude`
- telemetry: `vitesse`, `cap`, `precision_metres`
- generated spatial point: `geom`
- hypertable on `time`

Indexes:

- `vehicule_id, time desc`
- `time desc`
- `gist(geom)`

### `zones_geofencing`

- `id`
- `nom`
- `type`
- `geometrie` as PostGIS polygon
- `actif`
- `created_at`
- `updated_at`

Index:

- `gist(geometrie)`

### `alertes_geofencing`

- `id`
- `vehicule_id`
- `zone_id`
- `type_alerte` in `ENTER | EXIT`
- `detecte_le`

## Geofencing Rule

Alerts are generated only on state transitions:

- outside -> inside: `ENTER`
- inside -> outside: `EXIT`

Simple deduplication rule:

- repeated points on the same side of the zone boundary do not create new alerts
- the very first known point for a vehicle initializes state and does not emit an alert

This keeps noisy GPS data from generating duplicated enter/exit alerts.

## Kafka Events

Published event types:

- `position.updated`
- `geofence.alert`

Shared event envelope:

- `eventId`
- `eventType`
- `version`
- `timestamp`
- `source`
- `correlationId`
- `payload`

If Kafka is disabled or unavailable, the service falls back to a no-op publisher that logs the simulated event instead of failing the request.

## AI / Agent Integration

`GET /localisation/:id/analyse` provides an AI-style analysis layer on top of stored localisation data.

For the TP, the default implementation is a rule-based local agent that:

- analyses recent trajectory history
- computes total distance and speed indicators
- counts geofencing alerts
- returns human-readable insights

The service is intentionally isolated behind a dedicated provider so a real LLM-backed assistant can be plugged in later without refactoring the REST API.

## Example Payloads

### Ingest GPS point

```json
{
  "vehiculeId": "VH-001",
  "latitude": 49.4431,
  "longitude": 1.0993,
  "vitesse": 42.5,
  "cap": 180,
  "precision": 5.2,
  "time": "2026-04-03T09:15:00Z",
  "correlationId": "mission-123"
}
```

### Create zone

```json
{
  "nom": "Depot Rouen",
  "type": "DEPOT",
  "actif": true,
  "coordinates": [
    { "latitude": 49.4431, "longitude": 1.0901 },
    { "latitude": 49.4440, "longitude": 1.1020 },
    { "latitude": 49.4380, "longitude": 1.1010 }
  ]
}
```

The service automatically closes the polygon ring if the last point is not equal to the first one.
