"""ProfileEditRequest model (Phase 2).

A resident asks to change their profile. Guardian-only changes are
applied immediately by the service; name / phone / CNIC changes are
stored here as PENDING and only applied when the admin approves them.
``requested_changes`` is a JSON object with only the fields the
resident actually sent, e.g. ``{"full_name": "Ali Raza"}``.
"""

import enum
import json

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from app.core.database import Base


class ProfileEditStatus(str, enum.Enum):
    """Edit-request review state."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ProfileEditRequest(Base):
    """One pending profile-change request from a resident."""

    __tablename__ = "profile_edit_requests"

    id = Column(Integer, primary_key=True, index=True)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=False, index=True)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=False, index=True)
    requested_changes = Column(Text, nullable=False, default="{}")
    status = Column(String(20), nullable=False, default=ProfileEditStatus.PENDING.value)
    reason = Column(String(500), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def changes(self) -> dict:
        """Return the requested changes as a dict."""
        try:
            data = json.loads(self.requested_changes or "{}")
            return data if isinstance(data, dict) else {}
        except (ValueError, TypeError):
            return {}

    def set_changes(self, changes: dict) -> None:
        """Store the requested changes as JSON."""
        self.requested_changes = json.dumps(changes)
