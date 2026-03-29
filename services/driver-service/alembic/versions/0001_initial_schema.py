"""Initial schema – drivers, permis, assignations

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enum ──────────────────────────────────────────────────────────────────
    statut_driver = postgresql.ENUM(
        "actif", "inactif", "suspendu", name="statut_driver"
    )
    statut_driver.create(op.get_bind(), checkfirst=True)

    # ── drivers ───────────────────────────────────────────────────────────
    op.create_table(
        "drivers",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("nom", sa.String(50), nullable=False),
        sa.Column("prenom", sa.String(50), nullable=False),
        sa.Column("email", sa.String(100), nullable=False, unique=True),
        sa.Column("telephone", sa.String(20), nullable=True),
        sa.Column(
            "statut",
            postgresql.ENUM(
                "actif",
                "inactif",
                "suspendu",
                name="statut_driver",
                create_type=False,
            ),
            nullable=False,
            server_default="actif",
        ),
        sa.Column("date_naissance", sa.Date, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_drivers_email", "drivers", ["email"], unique=True)

    # ── permis ────────────────────────────────────────────────────────────────
    op.create_table(
        "permis",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("drivers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("categorie", sa.String(5), nullable=False),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("date_delivrance", sa.Date, nullable=False),
        sa.Column("date_expiration", sa.Date, nullable=False),
    )
    op.create_index("ix_permis_driver_id", "permis", ["driver_id"])
    op.create_index("ix_permis_numero", "permis", ["numero"], unique=True)

    # ── assignations ──────────────────────────────────────────────────────────
    op.create_table(
        "assignations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("drivers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("vehicule_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("date_debut", sa.DateTime(timezone=True), nullable=False),
        sa.Column("date_fin", sa.DateTime(timezone=True), nullable=True),
        sa.Column("statut", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_index("ix_assignations_driver_id", "assignations", ["driver_id"])
    op.create_index("ix_assignations_vehicule_id", "assignations", ["vehicule_id"])

    # Trigger updated_at auto (PostgreSQL)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_drivers_updated_at
        BEFORE UPDATE ON drivers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_drivers_updated_at ON drivers")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")
    op.drop_table("assignations")
    op.drop_table("permis")
    op.drop_table("drivers")
    op.execute("DROP TYPE IF EXISTS statut_driver")