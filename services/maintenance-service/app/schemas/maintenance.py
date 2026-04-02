import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict

from app.models.maintenance import TypeMaintenance, StatutMaintenance


# ──────────────────────────────────────────────
# PieceRemplacee schemas
# ──────────────────────────────────────────────

class PieceRemplaceeCreate(BaseModel):
    reference: str = Field(..., max_length=50)
    designation: str = Field(..., max_length=100)
    quantite: int = Field(..., ge=1)
    cout_unitaire: Decimal = Field(..., ge=0, decimal_places=2)


class PieceRemplaceeUpdate(BaseModel):
    reference: Optional[str] = Field(None, max_length=50)
    designation: Optional[str] = Field(None, max_length=100)
    quantite: Optional[int] = Field(None, ge=1)
    cout_unitaire: Optional[Decimal] = Field(None, ge=0, decimal_places=2)


class PieceRemplaceeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    maintenance_id: uuid.UUID
    reference: str
    designation: str
    quantite: int
    cout_unitaire: Decimal


# ──────────────────────────────────────────────
# Maintenance schemas
# ──────────────────────────────────────────────

class MaintenanceCreate(BaseModel):
    vehicule_id: uuid.UUID
    type: TypeMaintenance
    description: Optional[str] = None
    statut: StatutMaintenance = StatutMaintenance.planifiee
    date_planifiee: datetime
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    kilometrage_intervention: Optional[int] = None
    technicien_id: uuid.UUID
    cout_total: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    pieces_remplacees: List[PieceRemplaceeCreate] = []


class MaintenanceUpdate(BaseModel):
    type: Optional[TypeMaintenance] = None
    description: Optional[str] = None
    statut: Optional[StatutMaintenance] = None
    date_planifiee: Optional[datetime] = None
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    kilometrage_intervention: Optional[int] = None
    technicien_id: Optional[uuid.UUID] = None
    cout_total: Optional[Decimal] = Field(None, ge=0, decimal_places=2)


class MaintenanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vehicule_id: uuid.UUID
    type: TypeMaintenance
    description: Optional[str]
    statut: StatutMaintenance
    date_planifiee: datetime
    date_debut: Optional[datetime]
    date_fin: Optional[datetime]
    kilometrage_intervention: Optional[int]
    technicien_id: uuid.UUID
    cout_total: Optional[Decimal]
    created_at: datetime
    updated_at: datetime
    pieces_remplacees: List[PieceRemplaceeResponse] = []


class MaintenanceListResponse(BaseModel):
    total: int
    items: List[MaintenanceResponse]