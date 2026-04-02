import uuid
import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, String, Text, Integer, Numeric, SmallInteger,
    ForeignKey, Enum as SAEnum, func
)
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class TypeMaintenance(str, enum.Enum):
    preventive = "preventive"
    corrective = "corrective"
    predictive = "predictive"


class StatutMaintenance(str, enum.Enum):
    planifiee = "planifiee"
    en_cours = "en_cours"
    terminee = "terminee"
    annulee = "annulee"


class Maintenance(Base):
    __tablename__ = "maintenances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicule_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(SAEnum(TypeMaintenance, name="type_maintenance"), nullable=False)
    description = Column(Text, nullable=True)
    statut = Column(
        SAEnum(StatutMaintenance, name="statut_maintenance"),
        nullable=False,
        default=StatutMaintenance.planifiee,
    )
    date_planifiee = Column(TIMESTAMP(timezone=True), nullable=False)
    date_debut = Column(TIMESTAMP(timezone=True), nullable=True)
    date_fin = Column(TIMESTAMP(timezone=True), nullable=True)
    kilometrage_intervention = Column(Integer, nullable=True)
    technicien_id = Column(UUID(as_uuid=True), nullable=False)
    cout_total = Column(Numeric(10, 2), nullable=True)
    created_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    pieces_remplacees = relationship(
        "PieceRemplacee", back_populates="maintenance", cascade="all, delete-orphan"
    )


class PieceRemplacee(Base):
    __tablename__ = "pieces_remplacees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    maintenance_id = Column(
        UUID(as_uuid=True),
        ForeignKey("maintenances.id", ondelete="CASCADE"),
        nullable=False,
    )
    reference = Column(String(50), nullable=False)
    designation = Column(String(100), nullable=False)
    quantite = Column(SmallInteger, nullable=False)
    cout_unitaire = Column(Numeric(8, 2), nullable=False)

    maintenance = relationship("Maintenance", back_populates="pieces_remplacees")