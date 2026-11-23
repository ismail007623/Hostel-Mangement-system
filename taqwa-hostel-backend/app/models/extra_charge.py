"""ResidentExtraCharge model.

Extra monthly charges that live on the resident, NOT on the room
(e.g. AC, Cooler, Geyser). The admin enters the amount — no amount
is hardcoded. Geyser typically runs only ~3 winter months, so Qari
can switch an extra off (is_active=False, end_date set) and it
stops being charged.

RULE (locked): monthly total = base monthly_rent + sum of ACTIVE
extras. A change applies from the NEXT rent cycle only — it never
changes an already-created cycle's total_amount.
"""

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, func

from app.core.database import Base


class ResidentExtraCharge(Base):
    """One optional extra monthly charge for one resident."""

    __tablename__ = "resident_extra_charges"

    id = Column(Integer, primary_key=True, index=True)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    monthly_amount = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
