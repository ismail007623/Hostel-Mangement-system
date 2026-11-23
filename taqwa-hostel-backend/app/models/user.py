"""User model. One login account per person.

Role is stored here and never taken from a client payload. Phone is
the login ID and is unique; name is NOT unique (two Ali are possible).
"""

import enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.core.database import Base


class UserRole(str, enum.Enum):
    """Account roles. Admin = Qari; resident = a person living here."""

    ADMIN = "admin"
    RESIDENT = "resident"


class User(Base):
    """A login account (admin or resident)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default=UserRole.RESIDENT.value)
    full_name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    refresh_token_hash = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
