"""Phase 2: profile_edit_requests table + payment/resident columns.

Revision ID: 0002_phase2
Revises: 0001_baseline
Create Date: 2026-11-22

Adds:
- profile_edit_requests table (edit-profile approval flow).
- payments.reviewed_by and payments.screenshot_path.
- residents.guardian_name.

Every step checks first (inspector), so the migration is safe to run
on a database that was created by Base.metadata.create_all() in
Phase 1, where the new columns already exist.
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_phase2"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def _has_table(inspector, name: str) -> bool:
    """Return True when *name* is an existing table."""
    return name in inspector.get_table_names()


def _has_column(inspector, table: str, column: str) -> bool:
    """Return True when *column* exists on *table*."""
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    """Add Phase 2 tables and columns (only when missing)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not _has_table(inspector, "profile_edit_requests"):
        op.create_table(
            "profile_edit_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("resident_id", sa.Integer(), sa.ForeignKey("residents.id"), nullable=False),
            sa.Column("hostel_id", sa.Integer(), sa.ForeignKey("hostels.id"), nullable=False),
            sa.Column("requested_changes", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("reason", sa.String(500), nullable=True),
            sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_profile_edit_requests_id", "profile_edit_requests", ["id"])
        op.create_index("ix_profile_edit_requests_resident_id", "profile_edit_requests", ["resident_id"])
        op.create_index("ix_profile_edit_requests_hostel_id", "profile_edit_requests", ["hostel_id"])
    if not _has_column(inspector, "payments", "reviewed_by"):
        op.add_column("payments", sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    if not _has_column(inspector, "payments", "screenshot_path"):
        op.add_column("payments", sa.Column("screenshot_path", sa.String(500), nullable=True))
    if not _has_column(inspector, "residents", "guardian_name"):
        op.add_column("residents", sa.Column("guardian_name", sa.String(200), nullable=True))


def downgrade() -> None:
    """Remove the Phase 2 additions (only when present)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _has_column(inspector, "residents", "guardian_name"):
        op.drop_column("residents", "guardian_name")
    if _has_column(inspector, "payments", "screenshot_path"):
        op.drop_column("payments", "screenshot_path")
    if _has_column(inspector, "payments", "reviewed_by"):
        op.drop_column("payments", "reviewed_by")
    if _has_table(inspector, "profile_edit_requests"):
        op.drop_table("profile_edit_requests")
