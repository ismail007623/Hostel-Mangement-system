"""Payment model. Minimal in Phase 1; approval flow is Phase 2.

A resident uploads a rent screenshot in Phase 2; the admin approves
or rejects it there. Phase 1 only defines the table so the schema
and migrations stay stable.
"""

import enum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, func

from app.core.database import Base


class PaymentMethod(str, enum.Enum):
    """How rent was paid."""

    JAZZCASH = "JazzCash"
    EASYPAISA = "Easypaisa"
    BANK = "Bank"
    CASH = "Cash"


class PaymentStatus(str, enum.Enum):
    """Payment review state."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Payment(Base):
    """One rent payment (with screenshot in Phase 2)."""

    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=False, index=True)
    rent_cycle_id = Column(Integer, ForeignKey("rent_cycles.id"), nullable=True, index=True)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)
    method = Column(String(20), nullable=False)
    screenshot_url = Column(String(500), nullable=True)
    screenshot_path = Column(String(500), nullable=True)
    payment_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default=PaymentStatus.PENDING.value)
    reject_reason = Column(String(500), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
