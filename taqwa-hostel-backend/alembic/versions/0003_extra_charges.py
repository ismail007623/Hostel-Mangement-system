"""Migration 0003: resident_extra_charges table.

Revision ID: 0003_extra_charges
Revises: 0002_phase2
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_extra_charges"
down_revision = "0002_phase2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create resident_extra_charges (only when missing)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "resident_extra_charges" not in inspector.get_table_names():
        op.create_table(
            "resident_extra_charges",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("resident_id", sa.Integer(), sa.ForeignKey("residents.id"), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("monthly_amount", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_resident_extra_charges_id", "resident_extra_charges", ["id"])
        op.create_index("ix_resident_extra_charges_resident_id", "resident_extra_charges", ["resident_id"])


def downgrade() -> None:
    """Drop resident_extra_charges (only when present)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "resident_extra_charges" in inspector.get_table_names():
        op.drop_table("resident_extra_charges")
