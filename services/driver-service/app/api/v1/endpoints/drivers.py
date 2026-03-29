"""
Endpoints du service drivers:

  POST   /drivers                            Créer un driver
  GET    /drivers                            Lister (paginé + filtre statut)
  GET    /drivers/{id}                       Détail avec permis & assignations
  PUT    /drivers/{id}                       Modifier un driver
  PATCH  /drivers/{id}/statut               Changer le statut
  DELETE /drivers/{id}                       Supprimer

  GET    /drivers/{id}/permis                Liste des permis
  POST   /drivers/{id}/permis                Ajouter un permis
  PUT    /drivers/{id}/permis/{permis_id}    Modifier un permis
  DELETE /drivers/{id}/permis/{permis_id}    Supprimer un permis

  GET    /drivers/{id}/assignations          Liste des assignations
  POST   /drivers/{id}/assignations          Créer une assignation
  PATCH  /drivers/{id}/assignations/{aid}    Modifier une assignation (fin/statut)
  DELETE /drivers/{id}/assignations/{aid}    Supprimer une assignation
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenPayload, get_current_user, require_roles
from app.db.session import get_db
from app.kafka import producer as kafka
from app.models.driver import StatutDriver
from app.repositories.driver_repository import DriverRepository
from app.schemas.driver import (
    AssignationCreate,
    AssignationResponse,
    AssignationUpdate,
    DriverCreate,
    DriverDetailResponse,
    DriverResponse,
    DriverStatutUpdate,
    DriverUpdate,
    PaginatedResponse,
    PermisCreate,
    PermisResponse,
    PermisUpdate,
)

router = APIRouter(prefix="/drivers", tags=["Drivers"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _repo(db: AsyncSession = Depends(get_db)) -> DriverRepository:
    return DriverRepository(db)


async def _get_or_404(driver_id: uuid.UUID, repo: DriverRepository):
    driver = await repo.get_by_id(driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver {driver_id} introuvable",
        )
    return driver


# ── Drivers CRUD ──────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=DriverResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un driver",
)
async def create_driver(
    payload: DriverCreate,
    repo: DriverRepository = Depends(_repo)
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager", "dispatcher")),
):
    # Unicité email
    if await repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email {payload.email} déjà utilisé",
        )
    driver = await repo.create(payload)
    await kafka.emit_driver_created(
        str(driver.id), {"email": driver.email, "nom": driver.nom}
    )
    return driver


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="Lister les drivers (paginé)",
)
async def list_drivers(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    statut: StatutDriver | None = Query(default=None),
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    skip = (page - 1) * size
    items, total = await repo.get_all(skip=skip, limit=size, statut=statut)
    return PaginatedResponse(total=total, page=page, size=size, items=items)


@router.get(
    "/{driver_id}",
    response_model=DriverDetailResponse,
    summary="Détail d'un driver (avec permis et assignations)",
)
async def get_driver(
    driver_id: uuid.UUID,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    return await _get_or_404(driver_id, repo)


@router.put(
    "/{driver_id}",
    response_model=DriverResponse,
    summary="Modifier un driver",
)
async def update_driver(
    driver_id: uuid.UUID,
    payload: DriverUpdate,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    driver = await _get_or_404(driver_id, repo)

    # Vérifier unicité email si modifié
    if payload.email and payload.email != driver.email:
        if await repo.get_by_email(payload.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email {payload.email} déjà utilisé",
            )

    updated = await repo.update(driver, payload)
    await kafka.emit_driver_updated(
        str(driver_id), payload.model_dump(exclude_unset=True)
    )
    return updated


@router.patch(
    "/{driver_id}/statut",
    response_model=DriverResponse,
    summary="Changer le statut d'un driver",
)
async def update_statut(
    driver_id: uuid.UUID,
    payload: DriverStatutUpdate,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    driver = await _get_or_404(driver_id, repo)
    old_statut = driver.statut

    updated = await repo.update_statut(driver_id, payload.statut)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await kafka.emit_driver_statut_changed(
        str(driver_id), old_statut.value, payload.statut.value
    )
    return updated


@router.delete(
    "/{driver_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un driver",
)
async def delete_driver(
    driver_id: uuid.UUID,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin")),
):
    driver = await _get_or_404(driver_id, repo)
    await repo.delete(driver)
    await kafka.emit_driver_deleted(str(driver_id))


# ── Permis ────────────────────────────────────────────────────────────────────

@router.get(
    "/{driver_id}/permis",
    response_model=list[PermisResponse],
    summary="Lister les permis d'un driver",
)
async def list_permis(
    driver_id: uuid.UUID,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    await _get_or_404(driver_id, repo)
    return await repo.get_permis_by_driver(driver_id)


@router.post(
    "/{driver_id}/permis",
    response_model=PermisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter un permis à un driver",
)
async def add_permis(
    driver_id: uuid.UUID,
    payload: PermisCreate,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(driver_id, repo)
    permis = await repo.create_permis(driver_id, payload)
    await kafka.emit_permis_added(
        str(driver_id), str(permis.id), permis.categorie
    )
    return permis


@router.put(
    "/{driver_id}/permis/{permis_id}",
    response_model=PermisResponse,
    summary="Modifier un permis",
)
async def update_permis(
    driver_id: uuid.UUID,
    permis_id: uuid.UUID,
    payload: PermisUpdate,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(driver_id, repo)
    permis = await repo.get_permis_by_id(permis_id)
    if not permis or permis.driver_id != driver_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permis {permis_id} introuvable pour ce driver",
        )
    return await repo.update_permis(permis, payload)


@router.delete(
    "/{driver_id}/permis/{permis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un permis",
)
async def delete_permis(
    driver_id: uuid.UUID,
    permis_id: uuid.UUID,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(driver_id, repo)
    permis = await repo.get_permis_by_id(permis_id)
    if not permis or permis.driver_id != driver_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await repo.delete_permis(permis)


# ── Assignations ──────────────────────────────────────────────────────────────

@router.get(
    "/{driver_id}/assignations",
    response_model=list[AssignationResponse],
    summary="Lister les assignations d'un driver",
)
async def list_assignations(
    driver_id: uuid.UUID,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    await _get_or_404(driver_id, repo)
    return await repo.get_assignations_by_driver(driver_id)


@router.post(
    "/{driver_id}/assignations",
    response_model=AssignationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assigner un véhicule à un driver",
)
async def create_assignation(
    driver_id: uuid.UUID,
    payload: AssignationCreate,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager", "dispatcher")),
):
    driver = await _get_or_404(driver_id, repo)

    # Un driver inactif ou suspendu ne peut pas être assigné
    if driver.statut != StatutDriver.actif:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Impossible d'assigner un driver non actif",
        )

    # Vérifier qu'il n'a pas déjà une assignation active
    if await repo.get_active_assignation(driver_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Le driver a déjà une assignation active",
        )

    assignation = await repo.create_assignation(driver_id, payload)
    await kafka.emit_driver_assigned(
        str(driver_id), str(payload.vehicule_id), str(assignation.id)
    )
    return assignation


@router.patch(
    "/{driver_id}/assignations/{assignation_id}",
    response_model=AssignationResponse,
    summary="Modifier une assignation (clôturer, changer statut)",
)
async def update_assignation(
    driver_id: uuid.UUID,
    assignation_id: uuid.UUID,
    payload: AssignationUpdate,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager", "dispatcher")),
):
    await _get_or_404(driver_id, repo)
    assignation = await repo.get_assignation_by_id(assignation_id)
    if not assignation or assignation.driver_id != driver_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignation {assignation_id} introuvable",
        )
    return await repo.update_assignation(assignation, payload)


@router.delete(
    "/{driver_id}/assignations/{assignation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une assignation",
)
async def delete_assignation(
    driver_id: uuid.UUID,
    assignation_id: uuid.UUID,
    repo: DriverRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(driver_id, repo)
    assignation = await repo.get_assignation_by_id(assignation_id)
    if not assignation or assignation.driver_id != driver_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await repo.delete_assignation(assignation)