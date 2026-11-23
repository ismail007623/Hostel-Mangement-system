"""Resident and Application models.

A Resident is the hostel record for a person living here. An
Application is a pending onboarding request from the invite link;
it becomes a User + Resident only when the admin approves it and
assigns a seat. Name is NOT unique; phone and CNIC are unique.
"""

import enum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, func

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    """Onboarding application state."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Resident(Base):
    """A person currently living in the hostel."""

    __tablename__ = "residents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=False, index=True)
    seat_id = Column(Integer, ForeignKey("seats.id"), nullable=True, unique=True, index=True)
    father_name = Column(String(200), nullable=False)
    guardian_name = Column(String(200), nullable=True)
    guardian_phone = Column(String(20), nullable=False)
    cnic_number = Column(String(20), nullable=False, unique=True, index=True)
    photo_url = Column(String(500), nullable=True)
    cnic_photo_url = Column(String(500), nullable=True)
    start_date = Column(Date, nullable=False)
    monthly_rent = Column(Integer, nullable=False)
    security_paid = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Application(Base):
    """A pending onboarding application (invite-link or public apply)."""

    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=False, index=True)
    invite_token = Column(String(100), nullable=True, index=True)
    full_name = Column(String(200), nullable=False)
    father_name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=False, index=True)
    guardian_phone = Column(String(20), nullable=False)
    cnic_number = Column(String(20), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    monthly_rent = Column(Integer, nullable=False)
    security_paid = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default=ApplicationStatus.PENDING.value)
    reject_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
