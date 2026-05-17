import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import maintenances as maintenances_endpoints
from app.api.v1.router import api_router
from app.core.security import TokenPayload, get_current_user
from app.models.maintenance import (
    Maintenance,
    PieceRemplacee,
    StatutMaintenance,
    TypeMaintenance,
)


class FakeProducer:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple, dict]] = []

    async def emit_created(self, *args, **kwargs):
        self.calls.append(("emit_created", args, kwargs))

    async def emit_planned(self, *args, **kwargs):
        self.calls.append(("emit_planned", args, kwargs))

    async def emit_statut_changed(self, *args, **kwargs):
        self.calls.append(("emit_statut_changed", args, kwargs))

    async def emit_started(self, *args, **kwargs):
        self.calls.append(("emit_started", args, kwargs))

    async def emit_completed(self, *args, **kwargs):
        self.calls.append(("emit_completed", args, kwargs))

    async def emit_deleted(self, *args, **kwargs):
        self.calls.append(("emit_deleted", args, kwargs))


class FakeRepo:
    def __init__(self) -> None:
        self.maintenance = _make_maintenance()
        self.piece = _make_piece(self.maintenance.id)
        self.list_items = [self.maintenance]
        self.total = 1
        self.get_by_id_result = self.maintenance
        self.update_result = self.maintenance
        self.delete_result = True
        self.add_piece_result = self.piece
        self.delete_piece_result = True
        self.by_vehicule_result = [self.maintenance]

    async def create(self, payload):
        for field, value in payload.model_dump(exclude={"pieces_remplacees"}).items():
            setattr(self.maintenance, field, value)
        self.maintenance.pieces_remplacees = []
        return self.maintenance

    async def list_all(self, **_filters):
        return self.total, self.list_items

    async def get_by_id(self, maintenance_id: uuid.UUID):
        return self.get_by_id_result

    async def update(self, maintenance_id: uuid.UUID, payload):
        if self.update_result is None:
            return None
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(self.maintenance, field, value)
        return self.maintenance

    async def delete(self, maintenance_id: uuid.UUID):
        return self.delete_result

    async def get_by_vehicule(self, vehicule_id: uuid.UUID):
        return self.by_vehicule_result

    async def add_piece(self, maintenance_id: uuid.UUID, payload):
        if self.add_piece_result is None:
            return None
        self.piece = _make_piece(maintenance_id)
        return self.piece

    async def delete_piece(self, piece_id: uuid.UUID):
        return self.delete_piece_result


def _make_maintenance() -> Maintenance:
    maintenance = Maintenance(
        id=uuid.uuid4(),
        vehicule_id=uuid.uuid4(),
        type=TypeMaintenance.preventive,
        description="Controle",
        statut=StatutMaintenance.planifiee,
        date_planifiee=datetime(2024, 2, 1, tzinfo=timezone.utc),
        date_debut=None,
        date_fin=None,
        kilometrage_intervention=12000,
        technicien_id=uuid.uuid4(),
        cout_total=Decimal("150.00"),
    )
    maintenance.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    maintenance.updated_at = datetime(2024, 1, 2, tzinfo=timezone.utc)
    maintenance.pieces_remplacees = []
    return maintenance


def _make_piece(maintenance_id: uuid.UUID) -> PieceRemplacee:
    return PieceRemplacee(
        id=uuid.uuid4(),
        maintenance_id=maintenance_id,
        reference="REF-001",
        designation="Filtre",
        quantite=1,
        cout_unitaire=Decimal("35.50"),
    )


def _make_app(repo: FakeRepo, producer: FakeProducer, roles: list[str]) -> FastAPI:
    app = FastAPI()
    app.include_router(api_router)

    async def fake_user() -> TokenPayload:
        user = TokenPayload({"sub": "test-user", "email": "test@example.com"})
        user.roles = roles
        return user

    app.dependency_overrides[maintenances_endpoints.get_repo] = lambda: repo
    app.dependency_overrides[maintenances_endpoints.get_producer] = lambda: producer
    app.dependency_overrides[get_current_user] = fake_user
    return app


def _client(repo: FakeRepo, producer: FakeProducer, roles: list[str]) -> TestClient:
    return TestClient(_make_app(repo, producer, roles))


def test_create_maintenance_success(monkeypatch):
    repo = FakeRepo()
    producer = FakeProducer()
    client = _client(repo, producer, ["ADMIN"])
    metrics_calls = {"created": 0}

    def fake_record_created():
        metrics_calls["created"] += 1

    monkeypatch.setattr(
        maintenances_endpoints, "record_maintenance_created", fake_record_created
    )

    payload = {
        "vehicule_id": str(uuid.uuid4()),
        "type": "preventive",
        "description": "Controle",
        "statut": "planifiee",
        "date_planifiee": "2024-02-01T10:00:00Z",
        "date_debut": None,
        "date_fin": None,
        "kilometrage_intervention": 12000,
        "technicien_id": str(uuid.uuid4()),
        "cout_total": "150.00",
        "pieces_remplacees": [],
    }

    response = client.post("/api/v1/maintenances/", json=payload)
    assert response.status_code == 201
    assert metrics_calls["created"] == 1
    emitted = [call[0] for call in producer.calls]
    assert "emit_created" in emitted
    assert "emit_planned" in emitted


def test_list_maintenances():
    repo = FakeRepo()
    producer = FakeProducer()
    client = _client(repo, producer, ["USER"])

    response = client.get("/api/v1/maintenances/?skip=0&limit=10")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["description"] == repo.maintenance.description


def test_get_maintenance_not_found():
    repo = FakeRepo()
    repo.get_by_id_result = None
    producer = FakeProducer()
    client = _client(repo, producer, ["USER"])

    response = client.get(f"/api/v1/maintenances/{uuid.uuid4()}")
    assert response.status_code == 404


def test_update_maintenance_not_found():
    repo = FakeRepo()
    repo.update_result = None
    producer = FakeProducer()
    client = _client(repo, producer, ["MANAGER"])

    response = client.patch(
        f"/api/v1/maintenances/{uuid.uuid4()}",
        json={"description": "Update"},
    )
    assert response.status_code == 404


def test_change_statut_emits_started(monkeypatch):
    repo = FakeRepo()
    producer = FakeProducer()
    client = _client(repo, producer, ["TECHNICIEN"])
    metrics_calls = {"status": []}

    def fake_record_status(status: str):
        metrics_calls["status"].append(status)

    monkeypatch.setattr(
        maintenances_endpoints,
        "record_maintenance_status_changed",
        fake_record_status,
    )

    response = client.patch(
        f"/api/v1/maintenances/{repo.maintenance.id}/statut",
        params={"statut": "en_cours"},
    )
    assert response.status_code == 200
    emitted = [call[0] for call in producer.calls]
    assert "emit_started" in emitted
    assert "emit_statut_changed" in emitted
    assert metrics_calls["status"] == ["en_cours"]


def test_delete_maintenance_success(monkeypatch):
    repo = FakeRepo()
    producer = FakeProducer()
    client = _client(repo, producer, ["ADMIN"])
    metrics_calls = {"deleted": 0}

    def fake_record_deleted():
        metrics_calls["deleted"] += 1

    monkeypatch.setattr(
        maintenances_endpoints, "record_maintenance_deleted", fake_record_deleted
    )

    response = client.delete(f"/api/v1/maintenances/{repo.maintenance.id}")
    assert response.status_code == 204
    assert metrics_calls["deleted"] == 1
    emitted = [call[0] for call in producer.calls]
    assert "emit_deleted" in emitted


def test_add_piece_not_found():
    repo = FakeRepo()
    repo.add_piece_result = None
    producer = FakeProducer()
    client = _client(repo, producer, ["TECHNICIEN"])

    payload = {
        "reference": "REF-001",
        "designation": "Filtre",
        "quantite": 1,
        "cout_unitaire": "35.50",
    }

    response = client.post(
        f"/api/v1/maintenances/{repo.maintenance.id}/pieces", json=payload
    )
    assert response.status_code == 404


def test_delete_piece_success(monkeypatch):
    repo = FakeRepo()
    producer = FakeProducer()
    client = _client(repo, producer, ["MANAGER"])
    metrics_calls = {"removed": 0}

    def fake_record_removed():
        metrics_calls["removed"] += 1

    monkeypatch.setattr(
        maintenances_endpoints, "record_piece_removed", fake_record_removed
    )

    response = client.delete(
        f"/api/v1/maintenances/{repo.maintenance.id}/pieces/{uuid.uuid4()}"
    )
    assert response.status_code == 204
    assert metrics_calls["removed"] == 1

