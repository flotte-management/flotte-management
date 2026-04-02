import uuid
from typing import List, Optional, Tuple

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.maintenance import Maintenance, PieceRemplacee, StatutMaintenance, TypeMaintenance
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, PieceRemplaceeCreate


class MaintenanceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ──────────────────────────────────────────────
    # Maintenance CRUD
    # ──────────────────────────────────────────────

    async def create(self, data: MaintenanceCreate) -> Maintenance:
        pieces_data = data.pieces_remplacees
        maintenance_data = data.model_dump(exclude={"pieces_remplacees"})

        maintenance = Maintenance(**maintenance_data)
        self.session.add(maintenance)
        await self.session.flush()  # get generated id

        for piece in pieces_data:
            self.session.add(
                PieceRemplacee(**piece.model_dump(), maintenance_id=maintenance.id)
            )

        await self.session.commit()
        await self.session.refresh(maintenance)
        return await self.get_by_id(maintenance.id)  # reload with relationships

    async def get_by_id(self, maintenance_id: uuid.UUID) -> Optional[Maintenance]:
        result = await self.session.execute(
            select(Maintenance)
            .options(selectinload(Maintenance.pieces_remplacees))
            .where(Maintenance.id == maintenance_id)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self,
        skip: int = 0,
        limit: int = 20,
        vehicule_id: Optional[uuid.UUID] = None,
        technicien_id: Optional[uuid.UUID] = None,
        statut: Optional[StatutMaintenance] = None,
        type: Optional[TypeMaintenance] = None,
    ) -> Tuple[int, List[Maintenance]]:
        query = (
            select(Maintenance)
            .options(selectinload(Maintenance.pieces_remplacees))
        )
        count_query = select(func.count()).select_from(Maintenance)

        if vehicule_id:
            query = query.where(Maintenance.vehicule_id == vehicule_id)
            count_query = count_query.where(Maintenance.vehicule_id == vehicule_id)
        if technicien_id:
            query = query.where(Maintenance.technicien_id == technicien_id)
            count_query = count_query.where(Maintenance.technicien_id == technicien_id)
        if statut:
            query = query.where(Maintenance.statut == statut)
            count_query = count_query.where(Maintenance.statut == statut)
        if type:
            query = query.where(Maintenance.type == type)
            count_query = count_query.where(Maintenance.type == type)

        total = (await self.session.execute(count_query)).scalar_one()
        result = await self.session.execute(
            query.order_by(Maintenance.date_planifiee.desc()).offset(skip).limit(limit)
        )
        return total, list(result.scalars().all())

    async def update(
        self, maintenance_id: uuid.UUID, data: MaintenanceUpdate
    ) -> Optional[Maintenance]:
        maintenance = await self.get_by_id(maintenance_id)
        if not maintenance:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(maintenance, field, value)

        await self.session.commit()
        return await self.get_by_id(maintenance_id)

    async def delete(self, maintenance_id: uuid.UUID) -> bool:
        maintenance = await self.get_by_id(maintenance_id)
        if not maintenance:
            return False
        await self.session.delete(maintenance)
        await self.session.commit()
        return True

    async def get_by_vehicule(self, vehicule_id: uuid.UUID) -> List[Maintenance]:
        result = await self.session.execute(
            select(Maintenance)
            .options(selectinload(Maintenance.pieces_remplacees))
            .where(Maintenance.vehicule_id == vehicule_id)
            .order_by(Maintenance.date_planifiee.desc())
        )
        return list(result.scalars().all())

    # ──────────────────────────────────────────────
    # PieceRemplacee CRUD
    # ──────────────────────────────────────────────

    async def add_piece(
        self, maintenance_id: uuid.UUID, data: PieceRemplaceeCreate
    ) -> Optional[PieceRemplacee]:
        maintenance = await self.get_by_id(maintenance_id)
        if not maintenance:
            return None

        piece = PieceRemplacee(**data.model_dump(), maintenance_id=maintenance_id)
        self.session.add(piece)
        await self.session.commit()
        await self.session.refresh(piece)
        return piece

    async def get_piece(self, piece_id: uuid.UUID) -> Optional[PieceRemplacee]:
        result = await self.session.execute(
            select(PieceRemplacee).where(PieceRemplacee.id == piece_id)
        )
        return result.scalar_one_or_none()

    async def delete_piece(self, piece_id: uuid.UUID) -> bool:
        piece = await self.get_piece(piece_id)
        if not piece:
            return False
        await self.session.delete(piece)
        await self.session.commit()
        return True