import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenPayload, get_current_user, require_roles
from app.db.session import get_db
from app.kafka.producer import KafkaProducer, get_producer
from app.metrics import (
    record_maintenance_created,
    record_maintenance_deleted,
    record_maintenance_status_changed,
    record_piece_added,
    record_piece_removed,
)
from app.models.maintenance import StatutMaintenance, TypeMaintenance
from app.repositories.maintenance_repository import MaintenanceRepository
from app.schemas.maintenance import (
    MaintenanceCreate,
    MaintenanceUpdate,
    MaintenanceResponse,
    MaintenanceListResponse,
    PieceRemplaceeCreate,
    PieceRemplaceeResponse,
)

router = APIRouter(prefix="/maintenances", tags=["maintenances"])


def get_repo(db: AsyncSession = Depends(get_db)) -> MaintenanceRepository:
    return MaintenanceRepository(db)


# ──────────────────────────────────────────────────────────────
# POST /maintenances  — Créer une maintenance
# ──────────────────────────────────────────────────────────────
@router.post(
    "/",
    response_model=MaintenanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une maintenance",
)
async def create_maintenance(
    payload: MaintenanceCreate,
    repo: MaintenanceRepository = Depends(get_repo),
    producer: KafkaProducer = Depends(get_producer),
    _user: TokenPayload = Depends(require_roles("ADMIN", "MANAGER")),
):
    maintenance = await repo.create(payload)
    record_maintenance_created()
    technicien_id = str(maintenance.technicien_id) if maintenance.technicien_id else None
    date_planifiee = maintenance.date_planifiee.isoformat() if maintenance.date_planifiee else ""
    await producer.emit_created(
        maintenance_id=str(maintenance.id),
        vehicule_id=str(maintenance.vehicule_id),
        type_=maintenance.type.value,
        technicien_id=technicien_id,
        date_planifiee=date_planifiee,
    )
    # Also emit maintenance.planned for event-service notifications
    await producer.emit_planned(
        maintenance_id=str(maintenance.id),
        vehicule_id=str(maintenance.vehicule_id),
        type_=maintenance.type.value,
        date_planifiee=date_planifiee,
        technicien_id=technicien_id,
    )
    return maintenance


# ──────────────────────────────────────────────────────────────
# GET /maintenances  — Lister les maintenances (paginé + filtres)
# ──────────────────────────────────────────────────────────────
@router.get(
    "/",
    response_model=MaintenanceListResponse,
    summary="Lister les maintenances",
)
async def list_maintenances(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    vehicule_id: Optional[uuid.UUID] = Query(None),
    technicien_id: Optional[uuid.UUID] = Query(None),
    statut: Optional[StatutMaintenance] = Query(None),
    type: Optional[TypeMaintenance] = Query(None),
    repo: MaintenanceRepository = Depends(get_repo),
    _user: TokenPayload = Depends(get_current_user),
):
    total, items = await repo.list_all(
        skip=skip,
        limit=limit,
        vehicule_id=vehicule_id,
        technicien_id=technicien_id,
        statut=statut,
        type=type,
    )
    return MaintenanceListResponse(total=total, items=items)


# ──────────────────────────────────────────────────────────────
# GET /maintenances/{id}  — Détail d'une maintenance
# ──────────────────────────────────────────────────────────────
@router.get(
    "/{maintenance_id}",
    response_model=MaintenanceResponse,
    summary="Récupérer une maintenance",
)
async def get_maintenance(
    maintenance_id: uuid.UUID,
    repo: MaintenanceRepository = Depends(get_repo),
    _user: TokenPayload = Depends(get_current_user),
):
    maintenance = await repo.get_by_id(maintenance_id)
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")
    return maintenance


# ──────────────────────────────────────────────────────────────
# PATCH /maintenances/{id}  — Mettre à jour une maintenance
# ──────────────────────────────────────────────────────────────
@router.patch(
    "/{maintenance_id}",
    response_model=MaintenanceResponse,
    summary="Mettre à jour une maintenance",
)
async def update_maintenance(
    maintenance_id: uuid.UUID,
    payload: MaintenanceUpdate,
    repo: MaintenanceRepository = Depends(get_repo),
    producer: KafkaProducer = Depends(get_producer),
    _user: TokenPayload = Depends(require_roles("ADMIN", "MANAGER")),
):
    maintenance = await repo.update(maintenance_id, payload)
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")

    await producer.emit_statut_changed(
        maintenance_id=str(maintenance.id),
        vehicule_id=str(maintenance.vehicule_id),
        nouveau_statut=maintenance.statut.value,
    )
    return maintenance


# ──────────────────────────────────────────────────────────────
# DELETE /maintenances/{id}  — Supprimer une maintenance
# ──────────────────────────────────────────────────────────────
@router.delete(
    "/{maintenance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une maintenance",
)
async def delete_maintenance(
    maintenance_id: uuid.UUID,
    repo: MaintenanceRepository = Depends(get_repo),
    producer: KafkaProducer = Depends(get_producer),
    _user: TokenPayload = Depends(require_roles("ADMIN")),
):
    deleted = await repo.delete(maintenance_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")
    record_maintenance_deleted()
    await producer.emit_deleted(maintenance_id=str(maintenance_id))


# ──────────────────────────────────────────────────────────────
# PATCH /maintenances/{id}/statut  — Transition de statut
# ──────────────────────────────────────────────────────────────
@router.patch(
    "/{maintenance_id}/statut",
    response_model=MaintenanceResponse,
    summary="Changer le statut d'une maintenance",
)
async def change_statut(
    maintenance_id: uuid.UUID,
    statut: StatutMaintenance,
    repo: MaintenanceRepository = Depends(get_repo),
    producer: KafkaProducer = Depends(get_producer),
    _user: TokenPayload = Depends(require_roles("ADMIN", "MANAGER", "TECHNICIEN")),
):
    maintenance = await repo.update(maintenance_id, MaintenanceUpdate(statut=statut))
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")

    record_maintenance_status_changed(maintenance.statut.value)

    vehicule_id = str(maintenance.vehicule_id)

    # Emit saga events that trigger vehicle status changes
    if statut.value == "en_cours":
        await producer.emit_started(str(maintenance_id), vehicule_id)
    elif statut.value == "terminee":
        await producer.emit_completed(str(maintenance_id), vehicule_id)

    # Always emit the general statut_changed event
    await producer.emit_statut_changed(str(maintenance_id), vehicule_id, statut.value)
    return maintenance


# ──────────────────────────────────────────────────────────────
# GET /vehicules/{vehicule_id}/maintenances  — Historique véhicule
# ──────────────────────────────────────────────────────────────
@router.get(
    "/vehicules/{vehicule_id}/maintenances",
    response_model=list[MaintenanceResponse],
    summary="Historique des maintenances d'un véhicule",
)
async def get_maintenances_by_vehicule(
    vehicule_id: uuid.UUID,
    repo: MaintenanceRepository = Depends(get_repo),
    _user: TokenPayload = Depends(get_current_user),
):
    return await repo.get_by_vehicule(vehicule_id)


# ──────────────────────────────────────────────────────────────
# POST /maintenances/{id}/pieces  — Ajouter une pièce
# ──────────────────────────────────────────────────────────────
@router.post(
    "/{maintenance_id}/pieces",
    response_model=PieceRemplaceeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter une pièce remplacée",
)
async def add_piece(
    maintenance_id: uuid.UUID,
    payload: PieceRemplaceeCreate,
    repo: MaintenanceRepository = Depends(get_repo),
    _user: TokenPayload = Depends(require_roles("ADMIN", "MANAGER", "TECHNICIEN")),
):
    piece = await repo.add_piece(maintenance_id, payload)
    if not piece:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")
    record_piece_added()
    return piece


# ──────────────────────────────────────────────────────────────
# DELETE /maintenances/{id}/pieces/{piece_id}  — Retirer une pièce
# ──────────────────────────────────────────────────────────────
@router.delete(
    "/{maintenance_id}/pieces/{piece_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirer une pièce remplacée",
)
async def delete_piece(
    maintenance_id: uuid.UUID,
    piece_id: uuid.UUID,
    repo: MaintenanceRepository = Depends(get_repo),
    _user: TokenPayload = Depends(require_roles("ADMIN", "MANAGER", "TECHNICIEN")),
):
    deleted = await repo.delete_piece(piece_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Pièce introuvable")
    record_piece_removed()
