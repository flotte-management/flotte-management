"""
Repository : toutes les requêtes SQL asynchrones (pattern Repository).
Aucune logique métier ici, uniquement l'accès aux données.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.driver import Assignation, Driver, Permis, StatutDriver
from app.schemas.driver import (
    AssignationCreate,
    AssignationUpdate,
    DriverCreate,
    DriverUpdate,
    PermisCreate,
    PermisUpdate,
)


class DriverRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Drivers ────────────────────────────────────────────────────────

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 20,
        statut: StatutDriver | None = None,
    ) -> tuple[list[Driver], int]:
        stmt = select(Driver)
        count_stmt = select(func.count()).select_from(Driver)

        if statut:
            stmt = stmt.where(Driver.statut == statut)
            count_stmt = count_stmt.where(Driver.statut == statut)

        total: int = (await self.db.execute(count_stmt)).scalar_one()
        rows = (
            await self.db.execute(stmt.offset(skip).limit(limit).order_by(Driver.nom))
        ).scalars().all()
        return list(rows), total

    async def get_by_id(self, driver_id: uuid.UUID) -> Driver | None:
        stmt = (
            select(Driver)
            .where(Driver.id == driver_id)
            .options(
                selectinload(Driver.permis),
                selectinload(Driver.assignations),
            )
        )
        return (await self.db.execute(stmt)).scalars().first()

    async def get_by_email(self, email: str) -> Driver | None:
        stmt = select(Driver).where(Driver.email == email)
        return (await self.db.execute(stmt)).scalars().first()

    async def create(self, payload: DriverCreate) -> Driver:
        driver = Driver(**payload.model_dump())
        self.db.add(driver)
        await self.db.flush()
        await self.db.refresh(driver)
        return driver

    async def update(
        self, driver: Driver, payload: DriverUpdate
    ) -> Driver:
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(driver, field, value)
        await self.db.flush()
        await self.db.refresh(driver)
        return driver

    async def update_statut(
        self, driver_id: uuid.UUID, statut: StatutDriver
    ) -> Driver | None:
        stmt = (
            update(Driver)
            .where(Driver.id == driver_id)
            .values(statut=statut)
            .returning(Driver)
        )
        result = (await self.db.execute(stmt)).scalars().first()
        return result

    async def delete(self, driver: Driver) -> None:
        await self.db.delete(driver)
        await self.db.flush()

    # ── Permis ─────────────────────────────────────────────────────────────

    async def get_permis_by_driver(
        self, driver_id: uuid.UUID
    ) -> list[Permis]:
        stmt = select(Permis).where(Permis.driver_id == driver_id)
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_permis_by_id(self, permis_id: uuid.UUID) -> Permis | None:
        stmt = select(Permis).where(Permis.id == permis_id)
        return (await self.db.execute(stmt)).scalars().first()

    async def create_permis(
        self, driver_id: uuid.UUID, payload: PermisCreate
    ) -> Permis:
        permis = Permis(driver_id=driver_id, **payload.model_dump())
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

    async def get_assignations_by_driver(
        self, driver_id: uuid.UUID
    ) -> list[Assignation]:
        stmt = (
            select(Assignation)
            .where(Assignation.driver_id == driver_id)
            .order_by(Assignation.date_debut.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def get_assignation_by_id(
        self, assignation_id: uuid.UUID
    ) -> Assignation | None:
        stmt = select(Assignation).where(Assignation.id == assignation_id)
        return (await self.db.execute(stmt)).scalars().first()

    async def get_active_assignation(
        self, driver_id: uuid.UUID
    ) -> Assignation | None:
        """Retourne l'assignation active d'un driver, s'il en a une."""
        stmt = select(Assignation).where(
            Assignation.driver_id == driver_id,
            Assignation.statut == "active",
        )
        return (await self.db.execute(stmt)).scalars().first()

    async def create_assignation(
        self, driver_id: uuid.UUID, payload: AssignationCreate
    ) -> Assignation:
        assignation = Assignation(driver_id=driver_id, **payload.model_dump())
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