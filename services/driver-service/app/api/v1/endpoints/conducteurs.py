"""
Endpoints du service conducteurs:

  POST   /conducteurs                            Créer un conducteur
  GET    /conducteurs                            Lister (paginé + filtre statut)
  GET    /conducteurs/{id}                       Détail avec permis & assignations
  PUT    /conducteurs/{id}                       Modifier un conducteur
  PATCH  /conducteurs/{id}/statut               Changer le statut
  DELETE /conducteurs/{id}                       Supprimer

  GET    /conducteurs/{id}/permis                Liste des permis
  POST   /conducteurs/{id}/permis                Ajouter un permis
  PUT    /conducteurs/{id}/permis/{permis_id}    Modifier un permis
  DELETE /conducteurs/{id}/permis/{permis_id}    Supprimer un permis

  GET    /conducteurs/{id}/assignations          Liste des assignations
  POST   /conducteurs/{id}/assignations          Créer une assignation
  PATCH  /conducteurs/{id}/assignations/{aid}    Modifier une assignation (fin/statut)
  DELETE /conducteurs/{id}/assignations/{aid}    Supprimer une assignation
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenPayload, get_current_user, require_roles
from app.db.session import get_db
from app.kafka import producer as kafka
from app.models.conducteur import StatutConducteur
from app.repositories.conducteur_repository import ConducteurRepository
from app.schemas.conducteur import (
    AssignationCreate,
    AssignationResponse,
    AssignationUpdate,
    ConducteurCreate,
    ConducteurDetailResponse,
    ConducteurResponse,
    ConducteurStatutUpdate,
    ConducteurUpdate,
    PaginatedResponse,
    PermisCreate,
    PermisResponse,
    PermisUpdate,
)

router = APIRouter(prefix="/conducteurs", tags=["Conducteurs"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _repo(db: AsyncSession = Depends(get_db)) -> ConducteurRepository:
    return ConducteurRepository(db)


async def _get_or_404(conducteur_id: uuid.UUID, repo: ConducteurRepository):
    conducteur = await repo.get_by_id(conducteur_id)
    if not conducteur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conducteur {conducteur_id} introuvable",
        )
    return conducteur


# ── Conducteurs CRUD ──────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=ConducteurResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un conducteur",
)
async def create_conducteur(
    payload: ConducteurCreate,
    repo: ConducteurRepository = Depends(_repo)
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager", "dispatcher")),
):
    # Unicité email
    if await repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email {payload.email} déjà utilisé",
        )
    conducteur = await repo.create(payload)
    await kafka.emit_conducteur_created(
        str(conducteur.id), {"email": conducteur.email, "nom": conducteur.nom}
    )
    return conducteur


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="Lister les conducteurs (paginé)",
)
async def list_conducteurs(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    statut: StatutConducteur | None = Query(default=None),
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    skip = (page - 1) * size
    items, total = await repo.get_all(skip=skip, limit=size, statut=statut)
    return PaginatedResponse(total=total, page=page, size=size, items=items)


@router.get(
    "/{conducteur_id}",
    response_model=ConducteurDetailResponse,
    summary="Détail d'un conducteur (avec permis et assignations)",
)
async def get_conducteur(
    conducteur_id: uuid.UUID,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    return await _get_or_404(conducteur_id, repo)


@router.put(
    "/{conducteur_id}",
    response_model=ConducteurResponse,
    summary="Modifier un conducteur",
)
async def update_conducteur(
    conducteur_id: uuid.UUID,
    payload: ConducteurUpdate,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    conducteur = await _get_or_404(conducteur_id, repo)

    # Vérifier unicité email si modifié
    if payload.email and payload.email != conducteur.email:
        if await repo.get_by_email(payload.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email {payload.email} déjà utilisé",
            )

    updated = await repo.update(conducteur, payload)
    await kafka.emit_conducteur_updated(
        str(conducteur_id), payload.model_dump(exclude_unset=True)
    )
    return updated


@router.patch(
    "/{conducteur_id}/statut",
    response_model=ConducteurResponse,
    summary="Changer le statut d'un conducteur",
)
async def update_statut(
    conducteur_id: uuid.UUID,
    payload: ConducteurStatutUpdate,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    conducteur = await _get_or_404(conducteur_id, repo)
    old_statut = conducteur.statut

    updated = await repo.update_statut(conducteur_id, payload.statut)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await kafka.emit_conducteur_statut_changed(
        str(conducteur_id), old_statut.value, payload.statut.value
    )
    return updated


@router.delete(
    "/{conducteur_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un conducteur",
)
async def delete_conducteur(
    conducteur_id: uuid.UUID,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin")),
):
    conducteur = await _get_or_404(conducteur_id, repo)
    await repo.delete(conducteur)
    await kafka.emit_conducteur_deleted(str(conducteur_id))


# ── Permis ────────────────────────────────────────────────────────────────────

@router.get(
    "/{conducteur_id}/permis",
    response_model=list[PermisResponse],
    summary="Lister les permis d'un conducteur",
)
async def list_permis(
    conducteur_id: uuid.UUID,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    await _get_or_404(conducteur_id, repo)
    return await repo.get_permis_by_conducteur(conducteur_id)


@router.post(
    "/{conducteur_id}/permis",
    response_model=PermisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ajouter un permis à un conducteur",
)
async def add_permis(
    conducteur_id: uuid.UUID,
    payload: PermisCreate,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(conducteur_id, repo)
    permis = await repo.create_permis(conducteur_id, payload)
    await kafka.emit_permis_added(
        str(conducteur_id), str(permis.id), permis.categorie
    )
    return permis


@router.put(
    "/{conducteur_id}/permis/{permis_id}",
    response_model=PermisResponse,
    summary="Modifier un permis",
)
async def update_permis(
    conducteur_id: uuid.UUID,
    permis_id: uuid.UUID,
    payload: PermisUpdate,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(conducteur_id, repo)
    permis = await repo.get_permis_by_id(permis_id)
    if not permis or permis.conducteur_id != conducteur_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permis {permis_id} introuvable pour ce conducteur",
        )
    return await repo.update_permis(permis, payload)


@router.delete(
    "/{conducteur_id}/permis/{permis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un permis",
)
async def delete_permis(
    conducteur_id: uuid.UUID,
    permis_id: uuid.UUID,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(conducteur_id, repo)
    permis = await repo.get_permis_by_id(permis_id)
    if not permis or permis.conducteur_id != conducteur_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await repo.delete_permis(permis)


# ── Assignations ──────────────────────────────────────────────────────────────

@router.get(
    "/{conducteur_id}/assignations",
    response_model=list[AssignationResponse],
    summary="Lister les assignations d'un conducteur",
)
async def list_assignations(
    conducteur_id: uuid.UUID,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(get_current_user),
):
    await _get_or_404(conducteur_id, repo)
    return await repo.get_assignations_by_conducteur(conducteur_id)


@router.post(
    "/{conducteur_id}/assignations",
    response_model=AssignationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assigner un véhicule à un conducteur",
)
async def create_assignation(
    conducteur_id: uuid.UUID,
    payload: AssignationCreate,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager", "dispatcher")),
):
    conducteur = await _get_or_404(conducteur_id, repo)

    # Un conducteur inactif ou suspendu ne peut pas être assigné
    if conducteur.statut != StatutConducteur.actif:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Impossible d'assigner un conducteur non actif",
        )

    # Vérifier qu'il n'a pas déjà une assignation active
    if await repo.get_active_assignation(conducteur_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Le conducteur a déjà une assignation active",
        )

    assignation = await repo.create_assignation(conducteur_id, payload)
    await kafka.emit_conducteur_assigned(
        str(conducteur_id), str(payload.vehicule_id), str(assignation.id)
    )
    return assignation


@router.patch(
    "/{conducteur_id}/assignations/{assignation_id}",
    response_model=AssignationResponse,
    summary="Modifier une assignation (clôturer, changer statut)",
)
async def update_assignation(
    conducteur_id: uuid.UUID,
    assignation_id: uuid.UUID,
    payload: AssignationUpdate,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager", "dispatcher")),
):
    await _get_or_404(conducteur_id, repo)
    assignation = await repo.get_assignation_by_id(assignation_id)
    if not assignation or assignation.conducteur_id != conducteur_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignation {assignation_id} introuvable",
        )
    return await repo.update_assignation(assignation, payload)


@router.delete(
    "/{conducteur_id}/assignations/{assignation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une assignation",
)
async def delete_assignation(
    conducteur_id: uuid.UUID,
    assignation_id: uuid.UUID,
    repo: ConducteurRepository = Depends(_repo),
    # _user: TokenPayload = Depends(require_roles("admin", "fleet-manager")),
):
    await _get_or_404(conducteur_id, repo)
    assignation = await repo.get_assignation_by_id(assignation_id)
    if not assignation or assignation.conducteur_id != conducteur_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await repo.delete_assignation(assignation)