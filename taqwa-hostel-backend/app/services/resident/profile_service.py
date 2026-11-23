"""Resident profile logic: a resident sees ONLY their own record.

Every query is filtered by the resident's own user id from the JWT.
Any other id passed by the client is ignored.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.building import Building, Portion
from app.models.hostel import Hostel
from app.models.resident import Resident
from app.models.room import Room, Seat
from app.models.user import User
from app.utils.date_utils import next_due_date

logger = get_logger(__name__)


async def _resident_for_user(db: AsyncSession, user: User) -> Resident | None:
    """Return the resident row for this login user, or None."""
    try:
        logger.info("Fetching resident from DB")
        result = await db.execute(select(Resident).where(Resident.user_id == user.id))
        resident = result.scalars().first()
        logger.info("Resident fetched successfully.")
        return resident
    except Exception as e:
        logger.error(f"Database error while fetching resident: {e}")
        raise Exception(f"Database error while fetching resident: {e}")


async def get_me(db: AsyncSession, user: User) -> dict:
    """Return the logged-in resident's own profile (or admin's info)."""
    try:
        logger.info("Fetching profile from DB")
        resident = await _resident_for_user(db, user)
        data = {
            "user_id": user.id,
            "hostel_id": user.hostel_id,
            "role": user.role,
            "full_name": user.full_name,
            "phone": user.phone,
        }
        if resident:
            data["resident_id"] = resident.id
            data["start_date"] = str(resident.start_date)
            data["monthly_rent"] = resident.monthly_rent
            data["security_paid"] = resident.security_paid
        logger.info("Profile fetched successfully.")
        return data
    except Exception as e:
        logger.error(f"Database error while fetching profile: {e}")
        raise Exception(f"Database error while fetching profile: {e}")


async def get_my_room(db: AsyncSession, user: User) -> dict:
    """Return the resident's own room. No other resident is visible."""
    try:
        logger.info("Fetching resident room from DB")
        resident = await _resident_for_user(db, user)
        if resident is None:
            raise LookupError("Resident profile not found")
        result = await db.execute(select(Hostel).where(Hostel.id == user.hostel_id))
        hostel = result.scalars().first()
        duration = hostel.rent_duration_days if hostel else 30
        seat = None
        if resident.seat_id:
            result = await db.execute(select(Seat).where(Seat.id == resident.seat_id))
            seat = result.scalars().first()
        room = None
        if seat:
            result = await db.execute(select(Room).where(Room.id == seat.room_id))
            room = result.scalars().first()
        building = None
        if room:
            result = await db.execute(select(Building).where(Building.id == room.building_id))
            building = result.scalars().first()
        portion_name = None
        if room and room.portion_id:
            result = await db.execute(select(Portion).where(Portion.id == room.portion_id))
            portion = result.scalars().first()
            portion_name = portion.name if portion else None
        logger.info("Resident viewed own room successfully.")
        from app.services.admin import extra_charge_service

        extras = await extra_charge_service.list_extras(db, user.hostel_id, resident.id)
        extras_total = sum(e["monthly_amount"] for e in extras if e["is_active"])
        return {
            "full_name": user.full_name,
            "building_name": building.name if building else None,
            "portion_name": portion_name,
            "room_number": room.room_number if room else None,
            "seat_label": seat.seat_label if seat else None,
            "monthly_rent": resident.monthly_rent,
            "extras": extras,
            "extras_total": extras_total,
            "monthly_total": resident.monthly_rent + extras_total,
            "start_date": resident.start_date.isoformat(),
            "next_due_date": next_due_date(resident.start_date, duration).isoformat(),
            "security_paid": resident.security_paid,
        }
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching resident room: {e}")
        raise Exception(f"Database error while fetching resident room: {e}")


async def update_guardian_phone(db: AsyncSession, user: User, guardian_phone: str) -> dict:
    """Update only the resident's own guardian phone (low-risk direct edit)."""
    try:
        logger.info("Fetching resident from DB for guardian phone update")
        resident = await _resident_for_user(db, user)
        if resident is None:
            raise LookupError("Resident profile not found")
        resident.guardian_phone = guardian_phone
        await db.commit()
        logger.info("Resident updated guardian phone successfully.")
        return {"guardian_phone": guardian_phone}
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while updating guardian phone: {e}")
        raise Exception(f"Database error while updating guardian phone: {e}")
