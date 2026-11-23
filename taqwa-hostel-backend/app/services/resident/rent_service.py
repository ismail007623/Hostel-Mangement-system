"""Resident rent-cycle logic (Phase 2).

Rent rule (locked):
- due_date = start_date + rent_duration_days (default 30, from hostel settings).
- A fully-paid cycle creates the next cycle starting from the previous
  due date, NOT from the payment date, so a late payer gains no extra days.
- Final deadline = due_date + grace_days (from settings). A cycle is
  overdue only after the grace period passes.
- remaining is always total_amount - paid_amount; it is computed, never
  stored separately.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.hostel import Hostel
from app.models.rent import RentCycle, RentCycleStatus
from app.models.resident import Resident
from app.utils.date_utils import next_due_date

logger = get_logger(__name__)

DUE_SOON_DAYS = 3


def calculate_due_date(start_date: date, duration_days: int = 30) -> date:
    """Return the due date for a cycle starting on *start_date*.

    Args:
        start_date: First day of the rent cycle.
        duration_days: Rent duration in days (default 30).

    Returns:
        The due date as a ``date``.
    """
    return next_due_date(start_date, duration_days)


async def get_hostel_settings(db: AsyncSession, hostel_id: int) -> tuple[int, int]:
    """Return ``(rent_duration_days, grace_days)`` for a hostel.

    Args:
        db: Async database session.
        hostel_id: Hostel id.

    Returns:
        Tuple of (duration, grace) with safe defaults (30, 3).
    """
    try:
        logger.info("Fetching hostel settings from DB")
        result = await db.execute(select(Hostel).where(Hostel.id == hostel_id))
        hostel = result.scalars().first()
        if hostel is None:
            return 30, 3
        logger.info("Hostel settings fetched successfully.")
        return hostel.rent_duration_days or 30, hostel.grace_days or 0
    except Exception as e:
        logger.error(f"Database error while fetching hostel settings: {e}")
        raise Exception(f"Database error while fetching hostel settings: {e}")


def final_deadline(due_date: date, grace_days: int) -> date:
    """Return the last day to pay: due date plus grace days."""
    return due_date + timedelta(days=grace_days)


def effective_status(cycle: RentCycle, grace_days: int, today: date | None = None) -> str:
    """Return the effective status of a cycle on *today*.

    Args:
        cycle: The rent cycle row.
        grace_days: Grace days from hostel settings.
        today: Date to evaluate against (default: today).

    Returns:
        "paid" when fully paid, "partial" when some rent is paid,
        "overdue" when unpaid after due date + grace, else "due".
    """
    today = today or date.today()
    if cycle.paid_amount >= cycle.total_amount:
        return RentCycleStatus.PAID.value
    if cycle.paid_amount > 0:
        if today > final_deadline(cycle.due_date, grace_days):
            return RentCycleStatus.OVERDUE.value
        return RentCycleStatus.PARTIAL.value
    if today > final_deadline(cycle.due_date, grace_days):
        return RentCycleStatus.OVERDUE.value
    return RentCycleStatus.DUE.value


def remaining_amount(cycle: RentCycle) -> int:
    """Return what is still unpaid for a cycle (never below 0)."""
    return max(0, cycle.total_amount - cycle.paid_amount)


async def serialize_cycle(db: AsyncSession, cycle: RentCycle) -> dict:
    """Serialize one cycle with computed remaining, status and deadline."""
    try:
        logger.info("Serializing rent cycle")
        duration, grace = await get_hostel_settings(db, cycle.hostel_id)
        status = effective_status(cycle, grace)
        logger.info("Rent cycle serialized successfully.")
        result = await db.execute(select(Resident).where(Resident.id == cycle.resident_id))
        resident = result.scalars().first()
        base = resident.monthly_rent if resident else cycle.total_amount
        return {
            "id": cycle.id,
            "resident_id": cycle.resident_id,
            "start_date": cycle.start_date.isoformat(),
            "due_date": cycle.due_date.isoformat(),
            "final_deadline": final_deadline(cycle.due_date, grace).isoformat(),
            "grace_days": grace,
            "total_amount": cycle.total_amount,
            "base_amount": base,
            "extras_amount": max(0, cycle.total_amount - base),
            "paid_amount": cycle.paid_amount,
            "remaining": remaining_amount(cycle),
            "status": status,
        }
    except Exception as e:
        logger.error(f"Database error while serializing rent cycle: {e}")
        raise Exception(f"Database error while serializing rent cycle: {e}")


async def create_first_cycle(db: AsyncSession, resident: Resident) -> RentCycle | None:
    """Create the first rent cycle for a newly approved resident.

    Args:
        db: Async database session.
        resident: The resident row (must be committed already).

    Returns:
        The new cycle, or the existing first cycle when one already exists.
    """
    try:
        logger.info("Fetching rent cycles from DB")
        result = await db.execute(
            select(RentCycle)
            .where(RentCycle.resident_id == resident.id)
            .order_by(RentCycle.start_date.asc())
        )
        existing = result.scalars().first()
        if existing is not None:
            return existing
        duration, _grace = await get_hostel_settings(db, resident.hostel_id)
        # First cycle total = base rent + ACTIVE extras at creation time.
        from app.services.admin import extra_charge_service

        total = await extra_charge_service.monthly_total(db, resident)
        cycle = RentCycle(
            resident_id=resident.id,
            hostel_id=resident.hostel_id,
            start_date=resident.start_date,
            due_date=calculate_due_date(resident.start_date, duration),
            total_amount=total,
            paid_amount=0,
            status=RentCycleStatus.DUE.value,
        )
        db.add(cycle)
        await db.commit()
        await db.refresh(cycle)
        logger.info("First rent cycle created successfully.")
        return cycle
    except Exception as e:
        logger.error(f"Database error while creating first rent cycle: {e}")
        raise Exception(f"Database error while creating first rent cycle: {e}")


async def create_next_cycle(db: AsyncSession, cycle: RentCycle) -> RentCycle:
    """Create the next cycle after a cycle is fully paid.

    The next cycle starts from the previous due date, not the payment
    date, so a late payer does not gain extra days.

    Args:
        db: Async database session.
        cycle: The just-paid cycle.

    Returns:
        The new cycle.
    """
    try:
        logger.info("Fetching resident from DB for next cycle")
        result = await db.execute(select(Resident).where(Resident.id == cycle.resident_id))
        resident = result.scalars().first()
        duration, _grace = await get_hostel_settings(db, cycle.hostel_id)
        # Next cycle total = base rent + ACTIVE extras NOW. A change to
        # extras never rewrites this cycle — only the next one.
        from app.services.admin import extra_charge_service

        total = await extra_charge_service.monthly_total(db, resident) if resident else cycle.total_amount
        new_cycle = RentCycle(
            resident_id=cycle.resident_id,
            hostel_id=cycle.hostel_id,
            start_date=cycle.due_date,
            due_date=calculate_due_date(cycle.due_date, duration),
            total_amount=total,
            paid_amount=0,
            status=RentCycleStatus.DUE.value,
        )
        db.add(new_cycle)
        await db.commit()
        await db.refresh(new_cycle)
        logger.info("Next rent cycle created successfully.")
        return new_cycle
    except Exception as e:
        logger.error(f"Database error while creating next rent cycle: {e}")
        raise Exception(f"Database error while creating next rent cycle: {e}")


async def get_current_cycle(db: AsyncSession, resident_id: int) -> RentCycle | None:
    """Return the resident's latest cycle (the current one)."""
    try:
        logger.info("Fetching current rent cycle from DB")
        result = await db.execute(
            select(RentCycle)
            .where(RentCycle.resident_id == resident_id)
            .order_by(RentCycle.start_date.desc(), RentCycle.id.desc())
        )
        cycle = result.scalars().first()
        logger.info("Current rent cycle fetched successfully.")
        return cycle
    except Exception as e:
        logger.error(f"Database error while fetching current rent cycle: {e}")
        raise Exception(f"Database error while fetching current rent cycle: {e}")


async def list_cycles_for_resident(db: AsyncSession, resident_id: int) -> list[dict]:
    """Return all cycles for one resident, newest first."""
    try:
        logger.info("Fetching rent cycles from DB")
        result = await db.execute(
            select(RentCycle)
            .where(RentCycle.resident_id == resident_id)
            .order_by(RentCycle.start_date.desc(), RentCycle.id.desc())
        )
        rows = result.scalars().all()
        out = []
        for c in rows:
            out.append(await serialize_cycle(db, c))
        logger.info("Rent cycles fetched successfully.")
        return out
    except Exception as e:
        logger.error(f"Database error while fetching rent cycles: {e}")
        raise Exception(f"Database error while fetching rent cycles: {e}")


def next_due(start_date: date, duration_days: int = 30) -> date:
    """Return the next rent due date for a resident (Phase 1 helper)."""
    return next_due_date(start_date, duration_days)
