"""Admin building / portion / room / seat business logic."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.building import Building, Portion
from app.models.room import ROOM_SEAT_COUNT, Room, Seat, SeatStatus
from app.models.resident import Resident
from app.models.user import User
from app.schemas.admin.building import BuildingCreate, PortionCreate, RoomCreate

logger = get_logger(__name__)


def _to_dict_building(b: Building) -> dict:
    """Serialize a building row."""
    return {"id": b.id, "hostel_id": b.hostel_id, "name": b.name}


def _to_dict_room(r: Room) -> dict:
    """Serialize a room row."""
    return {
        "id": r.id,
        "building_id": r.building_id,
        "portion_id": r.portion_id,
        "room_number": r.room_number,
        "room_type": r.room_type,
    }


async def _get_building(db: AsyncSession, hostel_id: int, building_id: int) -> Building | None:
    """Return one building of this hostel, or None."""
    try:
        logger.info("Fetching building from DB")
        result = await db.execute(
            select(Building).where(Building.id == building_id, Building.hostel_id == hostel_id)
        )
        building = result.scalars().first()
        logger.info("Building fetched successfully.")
        return building
    except Exception as e:
        logger.error(f"Database error while fetching building: {e}")
        raise Exception(f"Database error while fetching building: {e}")


async def create_building(db: AsyncSession, hostel_id: int, payload: BuildingCreate) -> dict:
    """Create a building in the admin's hostel.

    Args:
        db: Async database session.
        hostel_id: Hostel from the admin's token.
        payload: Validated building data.

    Returns:
        The new building as a dict.

    Raises:
        ValueError: When a building with the same name already exists.
    """
    try:
        logger.info("Fetching building from DB")
        result = await db.execute(
            select(Building).where(Building.hostel_id == hostel_id, Building.name == payload.name)
        )
        if result.scalars().first():
            raise ValueError("Building already exists")
        building = Building(hostel_id=hostel_id, name=payload.name)
        db.add(building)
        await db.commit()
        await db.refresh(building)
        logger.info("Building created successfully.")
        return _to_dict_building(building)
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while creating building: {e}")
        raise Exception(f"Database error while creating building: {e}")


async def list_buildings(db: AsyncSession, hostel_id: int) -> list[dict]:
    """List all buildings in the hostel."""
    try:
        logger.info("Fetching buildings from DB")
        result = await db.execute(select(Building).where(Building.hostel_id == hostel_id))
        rows = result.scalars().all()
        logger.info("Buildings fetched successfully.")
        return [_to_dict_building(r) for r in rows]
    except Exception as e:
        logger.error(f"Database error while fetching buildings: {e}")
        raise Exception(f"Database error while fetching buildings: {e}")


async def create_portion(db: AsyncSession, hostel_id: int, building_id: int, payload: PortionCreate) -> dict:
    """Create a portion inside a building of this hostel."""
    try:
        logger.info("Fetching building from DB")
        building = await _get_building(db, hostel_id, building_id)
        if building is None:
            raise LookupError("Building not found")
        result = await db.execute(
            select(Portion).where(Portion.building_id == building_id, Portion.name == payload.name)
        )
        if result.scalars().first():
            raise ValueError("Portion already exists")
        portion = Portion(building_id=building_id, name=payload.name)
        db.add(portion)
        await db.commit()
        await db.refresh(portion)
        logger.info("Portion created successfully.")
        return {"id": portion.id, "building_id": portion.building_id, "name": portion.name}
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while creating portion: {e}")
        raise Exception(f"Database error while creating portion: {e}")


async def list_portions(db: AsyncSession, hostel_id: int, building_id: int) -> list[dict]:
    """List portions of one building (empty list when there are none)."""
    try:
        logger.info("Fetching building from DB")
        building = await _get_building(db, hostel_id, building_id)
        if building is None:
            raise LookupError("Building not found")
        result = await db.execute(select(Portion).where(Portion.building_id == building_id))
        rows = result.scalars().all()
        logger.info("Portions fetched successfully.")
        return [{"id": r.id, "building_id": r.building_id, "name": r.name} for r in rows]
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching portions: {e}")
        raise Exception(f"Database error while fetching portions: {e}")


async def create_room(db: AsyncSession, hostel_id: int, building_id: int, payload: RoomCreate) -> dict:
    """Create a room and auto-create its seats (2/3/4 from room_type)."""
    try:
        logger.info("Fetching building from DB")
        building = await _get_building(db, hostel_id, building_id)
        if building is None:
            raise LookupError("Building not found")
        if payload.portion_id is not None:
            result = await db.execute(
                select(Portion).where(
                    Portion.id == payload.portion_id, Portion.building_id == building_id
                )
            )
            if result.scalars().first() is None:
                raise LookupError("Portion not found")
        result = await db.execute(
            select(Room).where(
                Room.building_id == building_id, Room.room_number == payload.room_number
            )
        )
        if result.scalars().first():
            raise ValueError("Room number already exists in this building")
        room = Room(
            building_id=building_id,
            portion_id=payload.portion_id,
            room_number=payload.room_number,
            room_type=payload.room_type.value,
        )
        db.add(room)
        await db.flush()
        count = ROOM_SEAT_COUNT.get(payload.room_type.value, 2)
        seats = [
            Seat(room_id=room.id, seat_label=f"Seat {i}", status=SeatStatus.VACANT.value)
            for i in range(1, count + 1)
        ]
        db.add_all(seats)
        await db.commit()
        await db.refresh(room)
        logger.info("Room created successfully.")
        return _to_dict_room(room)
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while creating room: {e}")
        raise Exception(f"Database error while creating room: {e}")


async def list_rooms(db: AsyncSession, hostel_id: int, building_id: int) -> list[dict]:
    """List rooms of one building."""
    try:
        logger.info("Fetching building from DB")
        building = await _get_building(db, hostel_id, building_id)
        if building is None:
            raise LookupError("Building not found")
        result = await db.execute(select(Room).where(Room.building_id == building_id))
        rows = result.scalars().all()
        logger.info("Rooms fetched successfully.")
        return [_to_dict_room(r) for r in rows]
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching rooms: {e}")
        raise Exception(f"Database error while fetching rooms: {e}")


async def _get_room_in_hostel(db: AsyncSession, hostel_id: int, room_id: int) -> Room | None:
    """Return a room only when it belongs to this hostel, else None."""
    try:
        logger.info("Fetching room from DB")
        result = await db.execute(select(Room).where(Room.id == room_id))
        room = result.scalars().first()
        if room is None:
            return None
        result = await db.execute(select(Building).where(Building.id == room.building_id))
        building = result.scalars().first()
        if building is None or building.hostel_id != hostel_id:
            return None
        logger.info("Room fetched successfully.")
        return room
    except Exception as e:
        logger.error(f"Database error while fetching room: {e}")
        raise Exception(f"Database error while fetching room: {e}")


async def list_seats(db: AsyncSession, hostel_id: int, room_id: int) -> list[dict]:
    """List seats of one room in this hostel."""
    try:
        logger.info("Fetching room from DB")
        room = await _get_room_in_hostel(db, hostel_id, room_id)
        if room is None:
            raise LookupError("Room not found")
        result = await db.execute(select(Seat).where(Seat.room_id == room_id))
        rows = result.scalars().all()
        logger.info("Seats fetched successfully.")
        return [{"id": s.id, "room_id": s.room_id, "seat_label": s.seat_label, "status": s.status} for s in rows]
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching seats: {e}")
        raise Exception(f"Database error while fetching seats: {e}")


async def get_dashboard(db: AsyncSession, hostel_id: int) -> dict:
    """Return dashboard counts for the admin's hostel."""
    try:
        logger.info("Fetching dashboard counts from DB")
        result = await db.execute(
            select(func.count()).select_from(Resident).where(
                Resident.hostel_id == hostel_id, Resident.status == "active"
            )
        )
        total_residents = result.scalar() or 0
        result = await db.execute(
            select(func.count()).select_from(Building).where(Building.hostel_id == hostel_id)
        )
        total_buildings = result.scalar() or 0
        result = await db.execute(select(Building.id).where(Building.hostel_id == hostel_id))
        building_ids = list(result.scalars().all())
        if building_ids:
            result = await db.execute(
                select(func.count()).select_from(Room).where(Room.building_id.in_(building_ids))
            )
            total_rooms = result.scalar() or 0
            result = await db.execute(select(Room.id).where(Room.building_id.in_(building_ids)))
            room_ids = list(result.scalars().all())
        else:
            total_rooms = 0
            room_ids = []
        if room_ids:
            result = await db.execute(select(Seat).where(Seat.room_id.in_(room_ids)))
            seats = result.scalars().all()
        else:
            seats = []
        total_seats = len(seats)
        vacant = sum(1 for s in seats if s.status == SeatStatus.VACANT.value)
        occupied = sum(1 for s in seats if s.status == SeatStatus.OCCUPIED.value)
        # Rent counts (Phase 2) — imported here to avoid a module cycle.
        from app.services.admin.payment_service import get_rent_counts

        rent_counts = await get_rent_counts(db, hostel_id)
        logger.info("Dashboard counts fetched successfully.")
        return {
            "total_residents": total_residents,
            "total_seats": total_seats,
            "vacant_seats": vacant,
            "occupied_seats": occupied,
            "total_buildings": total_buildings,
            "total_rooms": total_rooms,
            "paid_this_month": rent_counts["paid_this_month"],
            "paid_amount_this_month": rent_counts["paid_amount_this_month"],
            "due_count": rent_counts["due_count"],
            "overdue_count": rent_counts["overdue_count"],
        }
    except Exception as e:
        logger.error(f"Database error while fetching dashboard: {e}")
        raise Exception(f"Database error while fetching dashboard: {e}")


async def list_room_residents(db: AsyncSession, hostel_id: int, room_id: int) -> list[dict]:
    """List residents living in one room (admin only, own hostel)."""
    try:
        logger.info("Fetching room residents from DB")
        room = await _get_room_in_hostel(db, hostel_id, room_id)
        if room is None:
            raise LookupError("Room not found")
        result = await db.execute(select(Seat.id).where(Seat.room_id == room_id))
        seat_ids = list(result.scalars().all())
        residents = []
        if seat_ids:
            result = await db.execute(select(Resident).where(Resident.seat_id.in_(seat_ids)))
            residents = result.scalars().all()
        out = []
        for r in residents:
            result = await db.execute(select(User).where(User.id == r.user_id))
            user = result.scalars().first()
            out.append(
                {
                    "id": r.id,
                    "full_name": user.full_name if user else "",
                    "phone": user.phone if user else "",
                    "monthly_rent": r.monthly_rent,
                    "security_paid": r.security_paid,
                    "start_date": r.start_date.isoformat(),
                    "status": r.status,
                    "seat_id": r.seat_id,
                }
            )
        logger.info("Room residents fetched successfully.")
        return out
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching room residents: {e}")
        raise Exception(f"Database error while fetching room residents: {e}")
