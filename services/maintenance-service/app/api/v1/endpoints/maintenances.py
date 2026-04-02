import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_roles, get_current_user
from app.db.session import get_db
from app.kafka.producer import KafkaProducer, get_producer
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
    #current_user: dict = Depends(require_roles(["admin", "technicien", "planificateur"])),
):
    maintenance = await repo.create(payload)
    await producer.send(
        topic="maintenance.created",
        key=str(maintenance.id),
        value={
            "maintenance_id": str(maintenance.id),
            "vehicule_id": str(maintenance.vehicule_id),
            "type": maintenance.type.value,
            "statut": maintenance.statut.value,
            "technicien_id": str(maintenance.technicien_id),
        },
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
    #current_user: dict = Depends(get_current_user),
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
    #current_user: dict = Depends(get_current_user),
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
    #current_user: dict = Depends(require_roles(["admin", "technicien", "planificateur"])),
):
    maintenance = await repo.update(maintenance_id, payload)
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")

    await producer.send(
        topic="maintenance.updated",
        key=str(maintenance.id),
        value={
            "maintenance_id": str(maintenance.id),
            "statut": maintenance.statut.value,
            "updated_fields": list(payload.model_dump(exclude_unset=True).keys()),
        },
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
    #current_user: dict = Depends(require_roles(["admin"])),
):
    deleted = await repo.delete(maintenance_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")
    await producer.send(
        topic="maintenance.deleted",
        key=str(maintenance_id),
        value={"maintenance_id": str(maintenance_id)},
    )


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
    #current_user: dict = Depends(require_roles(["admin", "technicien"])),
):
    maintenance = await repo.update(maintenance_id, MaintenanceUpdate(statut=statut))
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")

    await producer.send(
        topic="maintenance.statut_changed",
        key=str(maintenance_id),
        value={
            "maintenance_id": str(maintenance_id),
            "nouveau_statut": statut.value,
            "vehicule_id": str(maintenance.vehicule_id),
        },
    )
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
    #current_user: dict = Depends(get_current_user),
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
    #current_user: dict = Depends(require_roles(["admin", "technicien"])),
):
    piece = await repo.add_piece(maintenance_id, payload)
    if not piece:
        raise HTTPException(status_code=404, detail="Maintenance introuvable")
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
    #current_user: dict = Depends(require_roles(["admin", "technicien"])),
):
    deleted = await repo.delete_piece(piece_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Pièce introuvable")