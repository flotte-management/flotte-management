"""Add en_mission and en_conge to statut_driver enum

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-13 00:00:00.000000
"""

from alembic import op

# revision identifiers
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new enum values for driver status
    op.execute("ALTER TYPE statut_driver ADD VALUE IF NOT EXISTS 'en_mission'")
    op.execute("ALTER TYPE statut_driver ADD VALUE IF NOT EXISTS 'en_conge'")


def downgrade() -> None:
    # Downgrade not supported for enum value removal in PostgreSQL
    pass

