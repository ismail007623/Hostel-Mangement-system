"""Hostel model. One row per hostel (Taqwa in Phase 1, more in SaaS).

Settings (rent duration, grace days, security standard) live on the
hostel row so each hostel can have its own values later.
"""

from sqlalchemy import Column, DateTime, Integer, String, func

from app.core.database import Base


class Hostel(Base):
    """A hostel, e.g. Taqwa Boys Hostel."""

    __tablename__ = "hostels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)
    slug = Column(String(200), nullable=False, unique=True)
    address = Column(String(500), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    rent_duration_days = Column(Integer, nullable=False, default=30)
    grace_days = Column(Integer, nullable=False, default=3)
    security_standard = Column(Integer, nullable=False, default=10000)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
