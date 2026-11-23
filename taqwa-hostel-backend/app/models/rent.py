"""RentCycle model. Minimal in Phase 1 (used for the due-date math).

Phase 2 will create one RentCycle per resident per month and drive
the paid / due / overdue lists from it. Phase 1 only needs the
next-due-date calculation (start date + 30 days), which lives in
``app/utils/date_utils.py``.
"""

import enum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, func

from app.core.database import Base


class RentCycleStatus(str, enum.Enum):
    """Rent cycle state."""

    PAID = "paid"
    DUE = "due"
    OVERDUE = "overdue"
    PARTIAL = "partial"


class RentCycle(Base):
    """One monthly rent cycle for one resident."""

    __tablename__ = "rent_cycles"

    id = Column(Integer, primary_key=True, index=True)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=False, index=True)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    total_amount = Column(Integer, nullable=False)
    paid_amount = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default=RentCycleStatus.DUE.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
