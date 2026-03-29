"""
Schémas Pydantic pour les trois entités : Driver, Permis, Assignation.
Chaque entité dispose de trois variantes :
  • *Create  – payload entrant (POST)
  • *Update  – payload entrant partiel (PUT/PATCH)
  • *Response – payload sortant
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.driver import StatutDriver


# ── Permis ────────────────────────────────────────────────────────────────────

class PermisCreate(BaseModel):
    categorie: str = Field(..., max_length=5, examples=["B", "C", "D"])
    numero: str = Field(..., max_length=20)
    date_delivrance: date
    date_expiration: date


class PermisUpdate(BaseModel):
    categorie: str | None = Field(None, max_length=5)
    numero: str | None = Field(None, max_length=20)
    date_delivrance: date | None = None
    date_expiration: date | None = None


class PermisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    driver_id: uuid.UUID
    categorie: str
    numero: str
    date_delivrance: date
    date_expiration: date


# ── Assignation ───────────────────────────────────────────────────────────────

class AssignationCreate(BaseModel):
    vehicule_id: uuid.UUID
    date_debut: datetime
    date_fin: datetime | None = None
    statut: str = Field(default="active", max_length=20)


class AssignationUpdate(BaseModel):
    date_fin: datetime | None = None
    statut: str | None = Field(None, max_length=20)


class AssignationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    driver_id: uuid.UUID
    vehicule_id: uuid.UUID
    date_debut: datetime
    date_fin: datetime | None
    statut: str


# ── Driver ────────────────────────────────────────────────────────────────

class DriverCreate(BaseModel):
    nom: str = Field(..., max_length=50)
    prenom: str = Field(..., max_length=50)
    email: EmailStr
    telephone: str | None = Field(None, max_length=20)
    statut: StatutDriver = StatutDriver.actif
    date_naissance: date | None = None


class DriverUpdate(BaseModel):
    nom: str | None = Field(None, max_length=50)
    prenom: str | None = Field(None, max_length=50)
    email: EmailStr | None = None
    telephone: str | None = Field(None, max_length=20)
    date_naissance: date | None = None


class DriverStatutUpdate(BaseModel):
    statut: StatutDriver


class DriverResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nom: str
    prenom: str
    email: str
    telephone: str | None
    statut: StatutDriver
    date_naissance: date | None
    created_at: datetime
    updated_at: datetime


class DriverDetailResponse(DriverResponse):
    """Driver avec ses permis et assignations."""
    permis: list[PermisResponse] = []
    assignations: list[AssignationResponse] = []


# ── Pagination ────────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    total: int
    page: int
    size: int
    items: list[DriverResponse]