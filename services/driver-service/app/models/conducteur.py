"""
Modèles SQLAlchemy correspondant à l'ERD :
  • conducteurs
  • permis
  • assignations
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    UUID,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# ── Enum ──────────────────────────────────────────────────────────────────────

class StatutConducteur(str, enum.Enum):
    actif = "actif"
    inactif = "inactif"
    suspendu = "suspendu"


# ── Tables ────────────────────────────────────────────────────────────────────

class Conducteur(Base):
    __tablename__ = "conducteurs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nom: Mapped[str] = mapped_column(String(50), nullable=False)
    prenom: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    telephone: Mapped[str | None] = mapped_column(String(20))
    statut: Mapped[StatutConducteur] = mapped_column(
        Enum(StatutConducteur, name="statut_conducteur"),
        nullable=False,
        default=StatutConducteur.actif,
    )
    date_naissance: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relations
    permis: Mapped[list["Permis"]] = relationship(
        back_populates="conducteur", cascade="all, delete-orphan", lazy="select"
    )
    assignations: Mapped[list["Assignation"]] = relationship(
        back_populates="conducteur", cascade="all, delete-orphan", lazy="select"
    )


class Permis(Base):
    __tablename__ = "permis"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conducteur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conducteurs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    categorie: Mapped[str] = mapped_column(String(5), nullable=False)
    numero: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    date_delivrance: Mapped[date] = mapped_column(Date, nullable=False)
    date_expiration: Mapped[date] = mapped_column(Date, nullable=False)

    conducteur: Mapped["Conducteur"] = relationship(back_populates="permis")


class Assignation(Base):
    __tablename__ = "assignations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conducteur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conducteurs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vehicule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    date_debut: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    date_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    conducteur: Mapped["Conducteur"] = relationship(back_populates="assignations")