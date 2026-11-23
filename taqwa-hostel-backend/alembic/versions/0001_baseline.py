"""Baseline: create all Phase 1 tables.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-22
"""

from alembic import op

from app.core.database import Base
from app.models import *  # noqa: F401,F403

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create every table known to Base.metadata (idempotent)."""
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    """Drop every table known to Base.metadata."""
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
