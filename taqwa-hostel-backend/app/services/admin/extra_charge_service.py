"""Resident extra-charge logic.

RULE: monthly total = base monthly_rent + sum of ACTIVE extras.
A change applies from the NEXT rent cycle only — an already-created
cycle keeps its total_amount. Cycle totals are therefore computed
at cycle-creation time (see rent_service.create_first_cycle /
create_next_cycle), never rewritten here.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.extra_charge import ResidentExtraCharge
from app.models.resident import Resident
from app.schemas.admin.extra_charge import ExtraChargeCreate, ExtraChargeInput, ExtraChargeUpdate

logger = get_logger(__name__)

PRESET_NAMES = ("AC", "Cooler", "Geyser")


def serialize(charge: ResidentExtraCharge) -> dict:
    """Serialize one extra-charge row."""
    return {
        "id": charge.id,
        "resident_id": charge.resident_id,
        "name": charge.name,
        "monthly_amount": charge.monthly_amount,
        "is_active": charge.is_active,
        "start_date": charge.start_date.isoformat() if charge.start_date else None,
        "end_date": charge.end_date.isoformat() if charge.end_date else None,
    }


async def list_extras(db: AsyncSession, hostel_id: int, resident_id: int) -> list[dict]:
    """List all extras (active + inactive) for one resident of this hostel."""
    try:
        logger.info("Fetching extra charges from DB")
        resident = await _resident_in_hostel(db, hostel_id, resident_id)
        if resident is None:
            raise LookupError("Resident not found")
        result = await db.execute(
            select(ResidentExtraCharge)
            .where(ResidentExtraCharge.resident_id == resident_id)
            .order_by(ResidentExtraCharge.id.asc())
        )
        rows = result.scalars().all()
        logger.info("Extra charges fetched successfully.")
        return [serialize(r) for r in rows]
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching extra charges: {e}")
        raise Exception(f"Database error while fetching extra charges: {e}")


async def active_extras(db: AsyncSession, resident_id: int) -> list[ResidentExtraCharge]:
    """Return only the active extras for a resident (no hostel check)."""
    result = await db.execute(
        select(ResidentExtraCharge).where(
            ResidentExtraCharge.resident_id == resident_id,
            ResidentExtraCharge.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


async def active_extras_total(db: AsyncSession, resident_id: int) -> int:
    """Sum of the resident's ACTIVE extras (0 when there are none)."""
    rows = await active_extras(db, resident_id)
    return sum(r.monthly_amount for r in rows)


async def monthly_total(db: AsyncSession, resident: Resident) -> int:
    """Base rent + active extras — the amount of the NEXT rent cycle."""
    return resident.monthly_rent + await active_extras_total(db, resident.id)


async def _resident_in_hostel(db: AsyncSession, hostel_id: int, resident_id: int) -> Resident | None:
    """Return the resident only when it belongs to this hostel."""
    result = await db.execute(
        select(Resident).where(Resident.id == resident_id, Resident.hostel_id == hostel_id)
    )
    return result.scalars().first()


async def create_extras_for_resident(
    db: AsyncSession, resident_id: int, extras: list[ExtraChargeInput] | None
) -> list[dict]:
    """Create extra charges for a newly added / approved resident.

    Called BEFORE the first rent cycle is created, so the first
    cycle's total already includes them. Skips empty / zero amounts.
    """
    out: list[dict] = []
    for item in extras or []:
        if not item.name.strip() or item.monthly_amount <= 0:
            continue
        charge = ResidentExtraCharge(
            resident_id=resident_id,
            name=item.name.strip(),
            monthly_amount=item.monthly_amount,
            is_active=True,
            start_date=item.start_date or date.today(),
            end_date=None,
        )
        db.add(charge)
        await db.flush()
        out.append(serialize(charge))
    return out


async def add_extra(db: AsyncSession, hostel_id: int, resident_id: int, payload: ExtraChargeCreate) -> dict:
    """Add one extra charge to a resident (active from the next cycle)."""
    try:
        logger.info("Fetching resident from DB for extra charge")
        resident = await _resident_in_hostel(db, hostel_id, resident_id)
        if resident is None:
            raise LookupError("Resident not found")
        charge = ResidentExtraCharge(
            resident_id=resident_id,
            name=payload.name.strip(),
            monthly_amount=payload.monthly_amount,
            is_active=True,
            start_date=payload.start_date or date.today(),
            end_date=None,
        )
        db.add(charge)
        await db.commit()
        await db.refresh(charge)
        logger.info("Extra charge added successfully.")
        return serialize(charge)
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while adding extra charge: {e}")
        raise Exception(f"Database error while adding extra charge: {e}")


async def update_extra(
    db: AsyncSession, hostel_id: int, resident_id: int, charge_id: int, payload: ExtraChargeUpdate
) -> dict:
    """Update name / amount / dates of one extra charge."""
    try:
        logger.info("Fetching extra charge from DB")
        charge = await _get_charge(db, hostel_id, resident_id, charge_id)
        if charge is None:
            raise LookupError("Extra charge not found")
        if payload.name is not None:
            charge.name = payload.name.strip()
        if payload.monthly_amount is not None:
            charge.monthly_amount = payload.monthly_amount
        if payload.start_date is not None:
            charge.start_date = payload.start_date
        if payload.end_date is not None:
            charge.end_date = payload.end_date
        await db.commit()
        await db.refresh(charge)
        logger.info("Extra charge updated successfully.")
        return serialize(charge)
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while updating extra charge: {e}")
        raise Exception(f"Database error while updating extra charge: {e}")


async def _get_charge(
    db: AsyncSession, hostel_id: int, resident_id: int, charge_id: int
) -> ResidentExtraCharge | None:
    """Return one charge only when it belongs to this hostel's resident."""
    resident = await _resident_in_hostel(db, hostel_id, resident_id)
    if resident is None:
        return None
    result = await db.execute(
        select(ResidentExtraCharge).where(
            ResidentExtraCharge.id == charge_id,
            ResidentExtraCharge.resident_id == resident_id,
        )
    )
    return result.scalars().first()


async def toggle_extra(
    db: AsyncSession, hostel_id: int, resident_id: int, charge_id: int, is_active: bool
) -> dict:
    """Switch an extra on/off. Off sets end_date=today; on clears it.

    The change applies from the NEXT rent cycle only.
    """
    try:
        logger.info("Fetching extra charge from DB for toggle")
        charge = await _get_charge(db, hostel_id, resident_id, charge_id)
        if charge is None:
            raise LookupError("Extra charge not found")
        charge.is_active = is_active
        charge.end_date = None if is_active else date.today()
        await db.commit()
        await db.refresh(charge)
        logger.info("Extra charge toggled successfully.")
        return serialize(charge)
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while toggling extra charge: {e}")
        raise Exception(f"Database error while toggling extra charge: {e}")


async def remove_extra(db: AsyncSession, hostel_id: int, resident_id: int, charge_id: int) -> dict:
    """Delete one extra charge (applies from the next cycle only)."""
    try:
        logger.info("Fetching extra charge from DB for removal")
        charge = await _get_charge(db, hostel_id, resident_id, charge_id)
        if charge is None:
            raise LookupError("Extra charge not found")
        await db.delete(charge)
        await db.commit()
        logger.info("Extra charge removed successfully.")
        return {"id": charge_id, "removed": True}
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while removing extra charge: {e}")
        raise Exception(f"Database error while removing extra charge: {e}")
