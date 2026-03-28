"""
Repository : toutes les requêtes SQL asynchrones (pattern Repository).
Aucune logique métier ici, uniquement l'accès aux données.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conducteur import Assignation, Conducteur, Permis, StatutConducteur
from app.schemas.conducteur import (
    AssignationCreate,
    AssignationUpdate,
    ConducteurCreate,
    ConducteurUpdate,
    PermisCreate,
    PermisUpdate,
)


class ConducteurRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Conducteurs ────────────────────────────────────────────────────────

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 20,
        statut: StatutConducteur | None = None,
    ) -> tuple[list[Conducteur], int]:
        stmt = select(Conducteur)
        count_stmt = select(func.count()).select_from(Conducteur)

        if statut:
            stmt = stmt.where(Conducteur.statut == statut)
            count_stmt = count_stmt.where(Conducteur.statut == statut)

        total: int = (await self.db.execute(count_stmt)).scalar_one()
        rows = (
            await self.db.execute(stmt.offset(skip).limit(limit).order_by(Conducteur.nom))
        ).scalars().all()
        return list(rows), total

    async def get_by_id(self, conducteur_id: uuid.UUID) -> Conducteur | None:
        stmt = (
            select(Conducteur)
            .where(Conducteur.id == conducteur_id)
            .options(
                selectinload(Conducteur.permis),
                selectinload(Conducteur.assignations),
            )
        )
        return (await self.db.execute(stmt)).scalars().first()

    async def get_by_email(self, email: str) -> Conducteur | None:
        stmt = select(Conducteur).where(Conducteur.email == email)
        return (await self.db.execute(stmt)).scalars().first()

    async def create(self, payload: ConducteurCreate) -> Conducteur:
        conducteur = Conducteur(**payload.model_dump())
        self.db.add(conducteur)
        await self.db.flush()
        await self.db.refresh(conducteur)
        return conducteur

    async def update(
        self, conducteur: Conducteur, payload: ConducteurUpdate
    ) -> Conducteur:
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(conducteur, field, value)
        await self.db.flush()
        await self.db.refresh(conducteur)
        return conducteur

    async def update_statut(
        self, conducteur_id: uuid.UUID, statut: StatutConducteur
    ) -> Conducteur | None:
        stmt = (
            update(Conducteur)
            .where(Conducteur.id == conducteur_id)
            .values(statut=statut)
            .returning(Conducteur)
        )
        result = (await self.db.execute(stmt)).scalars().first()
        return result

    async def delete(self, conducteur: Conducteur) -> None:
        await self.db.delete(conducteur)
        await self.db.flush()

    # ── Permis ─────────────────────────────────────────────────────────────

    async def get_permis_by_conducteur(
        self, conducteur_id: uuid.UUID
    ) -> list[Permis]:
        stmt = select(Permis).where(Permis.conducteur_id == conducteur_id)
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_permis_by_id(self, permis_id: uuid.UUID) -> Permis | None:
        stmt = select(Permis).where(Permis.id == permis_id)
        return (await self.db.execute(stmt)).scalars().first()

    async def create_permis(
        self, conducteur_id: uuid.UUID, payload: PermisCreate
    ) -> Permis:
        permis = Permis(conducteur_id=conducteur_id, **payload.model_dump())
        self.db.add(permis)
        await self.db.flush()
        await self.db.refresh(permis)
        return permis

    async def update_permis(
        self, permis: Permis, payload: PermisUpdate
    ) -> Permis:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(permis, field, value)
        await self.db.flush()
        await self.db.refresh(permis)
        return permis

    async def delete_permis(self, permis: Permis) -> None:
        await self.db.delete(permis)
        await self.db.flush()

    # ── Assignations ────────────────────────────────────────────────────────

    async def get_assignations_by_conducteur(
        self, conducteur_id: uuid.UUID
    ) -> list[Assignation]:
        stmt = (
            select(Assignation)
            .where(Assignation.conducteur_id == conducteur_id)
            .order_by(Assignation.date_debut.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_assignation_by_id(
        self, assignation_id: uuid.UUID
    ) -> Assignation | None:
        stmt = select(Assignation).where(Assignation.id == assignation_id)
        return (await self.db.execute(stmt)).scalars().first()

    async def get_active_assignation(
        self, conducteur_id: uuid.UUID
    ) -> Assignation | None:
        """Retourne l'assignation active d'un conducteur, s'il en a une."""
        stmt = select(Assignation).where(
            Assignation.conducteur_id == conducteur_id,
            Assignation.statut == "active",
        )
        return (await self.db.execute(stmt)).scalars().first()

    async def create_assignation(
        self, conducteur_id: uuid.UUID, payload: AssignationCreate
    ) -> Assignation:
        assignation = Assignation(conducteur_id=conducteur_id, **payload.model_dump())
        self.db.add(assignation)
        await self.db.flush()
        await self.db.refresh(assignation)
        return assignation

    async def update_assignation(
        self, assignation: Assignation, payload: AssignationUpdate
    ) -> Assignation:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(assignation, field, value)
        await self.db.flush()
        await self.db.refresh(assignation)
        return assignation

    async def delete_assignation(self, assignation: Assignation) -> None:
        await self.db.delete(assignation)
        await self.db.flush()