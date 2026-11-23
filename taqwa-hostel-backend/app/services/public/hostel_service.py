"""Public hostel logic: info and vacant-seat counts only.

No names, phone numbers, or CNICs are ever returned here.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.building import Building, Portion
from app.models.hostel import Hostel
from app.models.room import Room, Seat, SeatStatus

logger = get_logger(__name__)


async def get_hostel(db: AsyncSession) -> dict:
    """Return public info for the first hostel (Taqwa in Phase 1)."""
    try:
        logger.info("Fetching hostel from DB")
        result = await db.execute(select(Hostel).order_by(Hostel.id))
        hostel = result.scalars().first()
        if hostel is None:
            raise LookupError("Hostel not found")
        logger.info("Hostel fetched successfully.")
        return {
            "id": hostel.id,
            "name": hostel.name,
            "address": hostel.address,
            "contact_phone": hostel.contact_phone,
        }
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching hostel: {e}")
        raise Exception(f"Database error while fetching hostel: {e}")


async def _get_first_hostel(db: AsyncSession) -> Hostel | None:
    """Return the first hostel row, or None."""
    try:
        logger.info("Fetching hostel from DB")
        result = await db.execute(select(Hostel).order_by(Hostel.id))
        hostel = result.scalars().first()
        logger.info("Hostel fetched successfully.")
        return hostel
    except Exception as e:
        logger.error(f"Database error while fetching hostel: {e}")
        raise Exception(f"Database error while fetching hostel: {e}")


async def get_vacant_seats(db: AsyncSession) -> list[dict]:
    """Return vacant seat counts per building and room type.

    Example: [{"building": "Building 1", "room_type": "2-seater",
    "vacant_seats": 3, "total_seats": 6}]
    """
    try:
        logger.info("Fetching vacant seats from DB")
        hostel = await _get_first_hostel(db)
        if hostel is None:
            return []
        result = await db.execute(select(Building).where(Building.hostel_id == hostel.id))
        buildings = result.scalars().all()
        out: list[dict] = []
        for building in buildings:
            result = await db.execute(select(Room).where(Room.building_id == building.id))
            rooms = result.scalars().all()
            by_type: dict[str, dict[str, int]] = {}
            for room in rooms:
                result = await db.execute(select(Seat).where(Seat.room_id == room.id))
                seats = result.scalars().all()
                entry = by_type.setdefault(room.room_type, {"vacant": 0, "total": 0})
                entry["total"] += len(seats)
                entry["vacant"] += sum(1 for s in seats if s.status == SeatStatus.VACANT.value)
            for room_type, counts in by_type.items():
                out.append(
                    {
                        "building": building.name,
                        "room_type": room_type,
                        "vacant_seats": counts["vacant"],
                        "total_seats": counts["total"],
                    }
                )
        logger.info("Vacant seats fetched successfully.")
        return out
    except Exception as e:
        logger.error(f"Database error while fetching vacant seats: {e}")
        raise Exception(f"Database error while fetching vacant seats: {e}")


async def get_vacant_seats_by_room(db: AsyncSession) -> list[dict]:
    """Return vacant seat counts per room (public, Phase 3 landing).

    No names, phones, or CNICs — only building, portion, room number,
    room type, and vacant/total seat counts, so the landing page can
    show a live seat map per room.
    """
    try:
        logger.info("Fetching vacant seats by room from DB")
        hostel = await _get_first_hostel(db)
        if hostel is None:
            return []
        result = await db.execute(select(Building).where(Building.hostel_id == hostel.id))
        buildings = result.scalars().all()
        out: list[dict] = []
        for building in buildings:
            result = await db.execute(select(Room).where(Room.building_id == building.id))
            rooms = result.scalars().all()
            for room in rooms:
                result = await db.execute(select(Seat).where(Seat.room_id == room.id))
                seats = result.scalars().all()
                portion_name = None
                if room.portion_id:
                    result = await db.execute(select(Portion).where(Portion.id == room.portion_id))
                    portion = result.scalars().first()
                    portion_name = portion.name if portion else None
                out.append(
                    {
                        "building": building.name,
                        "portion": portion_name,
                        "room_number": room.room_number,
                        "room_type": room.room_type,
                        "vacant_seats": sum(1 for s in seats if s.status == SeatStatus.VACANT.value),
                        "total_seats": len(seats),
                    }
                )
        logger.info("Vacant seats by room fetched successfully.")
        return out
    except Exception as e:
        logger.error(f"Database error while fetching vacant seats by room: {e}")
        raise Exception(f"Database error while fetching vacant seats by room: {e}")
