"""initial schema – maintenances

Revision ID: 0001
Revises: 
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enums ─────────────────────────────────────────────────
    op.execute(
        """
        CREATE TYPE type_maintenance AS ENUM (
            'preventive', 'corrective', 'predictive'
        )
        """
    )
    op.execute(
        """
        CREATE TYPE statut_maintenance AS ENUM (
            'planifiee', 'en_cours', 'terminee', 'annulee'
        )
        """
    )

    # ── maintenances ──────────────────────────────────────────
    op.create_table(
        "maintenances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vehicule_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "type",
            sa.Enum("preventive", "corrective", "predictive", name="type_maintenance", create_type=False),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "statut",
            sa.Enum("planifiee", "en_cours", "terminee", "annulee", name="statut_maintenance", create_type=False),
            nullable=False,
            server_default="planifiee",
        ),
        sa.Column("date_planifiee", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("date_debut", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("date_fin", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("kilometrage_intervention", sa.Integer, nullable=True),
        sa.Column("technicien_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cout_total", sa.Numeric(10, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_index("ix_maintenances_vehicule_id", "maintenances", ["vehicule_id"])
    op.create_index("ix_maintenances_technicien_id", "maintenances", ["technicien_id"])
    op.create_index("ix_maintenances_statut", "maintenances", ["statut"])

    # ── pieces_remplacees ─────────────────────────────────────
    op.create_table(
        "pieces_remplacees",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "maintenance_id",
            UUID(as_uuid=True),
            sa.ForeignKey("maintenances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reference", sa.String(50), nullable=False),
        sa.Column("designation", sa.String(100), nullable=False),
        sa.Column("quantite", sa.SmallInteger, nullable=False),
        sa.Column("cout_unitaire", sa.Numeric(8, 2), nullable=False),
    )

    op.create_index("ix_pieces_maintenance_id", "pieces_remplacees", ["maintenance_id"])

    # ── trigger updated_at ────────────────────────────────────
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_maintenances_updated_at
        BEFORE UPDATE ON maintenances
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_maintenances_updated_at ON maintenances")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at")
    op.drop_table("pieces_remplacees")
    op.drop_table("maintenances")
    op.execute("DROP TYPE IF EXISTS statut_maintenance")
    op.execute("DROP TYPE IF EXISTS type_maintenance")