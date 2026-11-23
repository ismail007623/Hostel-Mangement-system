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


def _page_params(page: int, page_size: int) -> tuple[int, int]:
    """Clamp pagination params (page >= 1, 1 <= page_size <= 100)."""
    return max(1, page), min(100, max(1, page_size))


def _paginated(items: list[dict], total: int, page: int, page_size: int) -> dict:
    """Wrap a page of items with total / pages metadata."""
    page, page_size = _page_params(page, page_size)
    pages = (total + page_size - 1) // page_size if total else 0
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


async def _room_card(db: AsyncSession, room: Room) -> dict:
    """Enrich a room with seat counts and its residents (for room cards)."""
    from app.services.admin import extra_charge_service

    result = await db.execute(select(Seat).where(Seat.room_id == room.id))
    seats = result.scalars().all()
    vacant = sum(1 for s in seats if s.status == SeatStatus.VACANT.value)
    occupied = sum(1 for s in seats if s.status == SeatStatus.OCCUPIED.value)
    seat_ids = [s.id for s in seats]
    residents: list[dict] = []
    if seat_ids:
        result = await db.execute(select(Resident).where(Resident.seat_id.in_(seat_ids)))
        for r in result.scalars().all():
            result = await db.execute(select(User).where(User.id == r.user_id))
            user = result.scalars().first()
            residents.append(
                {
                    "id": r.id,
                    "full_name": user.full_name if user else "",
                    "phone": user.phone if user else "",
                    "monthly_rent": r.monthly_rent,
                    "extras_total": await extra_charge_service.active_extras_total(db, r.id),
                    "monthly_total": r.monthly_rent + await extra_charge_service.active_extras_total(db, r.id),
                    "seat_id": r.seat_id,
                }
            )
    return {
        **_to_dict_room(room),
        "total_seats": len(seats),
        "vacant_seats": vacant,
        "occupied_seats": occupied,
        "residents": residents,
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


async def list_buildings(db: AsyncSession, hostel_id: int, page: int = 1, page_size: int = 20) -> dict:
    """List buildings in the hostel, paginated (default 20 per page)."""
    try:
        logger.info("Fetching buildings from DB")
        page, page_size = _page_params(page, page_size)
        total_result = await db.execute(
            select(func.count()).select_from(Building).where(Building.hostel_id == hostel_id)
        )
        total = total_result.scalar() or 0
        result = await db.execute(
            select(Building)
            .where(Building.hostel_id == hostel_id)
            .order_by(Building.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = result.scalars().all()
        logger.info("Buildings fetched successfully.")
        return _paginated([_to_dict_building(r) for r in rows], total, page, page_size)
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


async def list_rooms(db: AsyncSession, hostel_id: int, building_id: int, page: int = 1, page_size: int = 20) -> dict:
    """List rooms of one building, paginated, as enriched room cards."""
    try:
        logger.info("Fetching building from DB")
        building = await _get_building(db, hostel_id, building_id)
        if building is None:
            raise LookupError("Building not found")
        page, page_size = _page_params(page, page_size)
        total_result = await db.execute(
            select(func.count()).select_from(Room).where(Room.building_id == building_id)
        )
        total = total_result.scalar() or 0
        result = await db.execute(
            select(Room)
            .where(Room.building_id == building_id)
            .order_by(Room.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = result.scalars().all()
        logger.info("Rooms fetched successfully.")
        return _paginated([await _room_card(db, r) for r in rows], total, page, page_size)
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching rooms: {e}")
        raise Exception(f"Database error while fetching rooms: {e}")


async def list_all_rooms(db: AsyncSession, hostel_id: int, page: int = 1, page_size: int = 20) -> dict:
    """List all rooms of the hostel (every building), paginated, as room cards."""
    try:
        logger.info("Fetching rooms from DB")
        page, page_size = _page_params(page, page_size)
        result = await db.execute(select(Building.id).where(Building.hostel_id == hostel_id))
        building_ids = list(result.scalars().all())
        if not building_ids:
            return _paginated([], 0, page, page_size)
        total_result = await db.execute(
            select(func.count()).select_from(Room).where(Room.building_id.in_(building_ids))
        )
        total = total_result.scalar() or 0
        result = await db.execute(
            select(Room)
            .where(Room.building_id.in_(building_ids))
            .order_by(Room.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = result.scalars().all()
        logger.info("Rooms fetched successfully.")
        return _paginated([await _room_card(db, r) for r in rows], total, page, page_size)
    except Exception as e:
        logger.error(f"Database error while fetching rooms: {e}")
        raise Exception(f"Database error while fetching rooms: {e}")


async def resolve_building_for_room(db: AsyncSession, hostel_id: int, building_id: int | None) -> Building:
    """Resolve the building for a room create with an optional building.

    Explicit id wins. Blank + exactly one building -> that building.
    Blank + no building -> auto-create "Main Building" and use it.
    Blank + several buildings -> ValueError (a building is required).
    """
    try:
        logger.info("Resolving building for room")
        if building_id is not None:
            building = await _get_building(db, hostel_id, building_id)
            if building is None:
                raise LookupError("Building not found")
            return building
        result = await db.execute(select(Building).where(Building.hostel_id == hostel_id))
        buildings = result.scalars().all()
        if len(buildings) == 1:
            return buildings[0]
        if len(buildings) == 0:
            building = Building(hostel_id=hostel_id, name="Main Building")
            db.add(building)
            await db.commit()
            await db.refresh(building)
            logger.info("Main Building auto-created successfully.")
            return building
        raise ValueError("Please pick a building — there is more than one")
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while resolving building: {e}")
        raise Exception(f"Database error while resolving building: {e}")


async def create_room_flexible(db: AsyncSession, hostel_id: int, payload) -> dict:
    """Create a room, resolving an optional building (see resolve rule)."""
    building = await resolve_building_for_room(db, hostel_id, payload.building_id)
    return await create_room(
        db, hostel_id, building.id,
        RoomCreate(room_number=payload.room_number, room_type=payload.room_type, portion_id=payload.portion_id),
    )


async def update_room(db: AsyncSession, hostel_id: int, room_id: int, payload) -> dict:
    """Edit a room's number / type / portion.

    Changing the type adjusts seats: growing adds vacant seats;
    shrinking removes only vacant seats and fails when an occupied
    seat would have to go (a resident lives there).
    """
    try:
        logger.info("Fetching room from DB for update")
        room = await _get_room_in_hostel(db, hostel_id, room_id)
        if room is None:
            raise LookupError("Room not found")
        if payload.room_number is not None and payload.room_number != room.room_number:
            result = await db.execute(
                select(Room).where(
                    Room.building_id == room.building_id, Room.room_number == payload.room_number
                )
            )
            if result.scalars().first():
                raise ValueError("Room number already exists in this building")
            room.room_number = payload.room_number
        if payload.portion_id is not None:
            result = await db.execute(
                select(Portion).where(Portion.id == payload.portion_id, Portion.building_id == room.building_id)
            )
            if result.scalars().first() is None:
                raise LookupError("Portion not found")
            room.portion_id = payload.portion_id
        if payload.room_type is not None and payload.room_type.value != room.room_type:
            new_count = ROOM_SEAT_COUNT.get(payload.room_type.value, 2)
            result = await db.execute(select(Seat).where(Seat.room_id == room.id).order_by(Seat.id.asc()))
            seats = list(result.scalars().all())
            if new_count > len(seats):
                for i in range(len(seats) + 1, new_count + 1):
                    db.add(Seat(room_id=room.id, seat_label=f"Seat {i}", status=SeatStatus.VACANT.value))
            elif new_count < len(seats):
                extra = seats[new_count:]
                if any(s.status == SeatStatus.OCCUPIED.value for s in extra):
                    raise ValueError("Cannot shrink the room — a resident occupies a seat that would be removed")
                for s in extra:
                    await db.delete(s)
            room.room_type = payload.room_type.value
        await db.commit()
        await db.refresh(room)
        logger.info("Room updated successfully.")
        return await _room_card(db, room)
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while updating room: {e}")
        raise Exception(f"Database error while updating room: {e}")


async def get_room_detail(db: AsyncSession, hostel_id: int, room_id: int) -> dict:
    """Return one room card plus its seats and each resident's extras."""
    from app.services.admin import extra_charge_service

    try:
        logger.info("Fetching room from DB")
        room = await _get_room_in_hostel(db, hostel_id, room_id)
        if room is None:
            raise LookupError("Room not found")
        card = await _room_card(db, room)
        result = await db.execute(select(Seat).where(Seat.room_id == room_id))
        seats = result.scalars().all()
        card["seats"] = [
            {"id": s.id, "room_id": s.room_id, "seat_label": s.seat_label, "status": s.status}
            for s in seats
        ]
        for r in card["residents"]:
            r["extras"] = await extra_charge_service.list_extras(db, hostel_id, r["id"])
        logger.info("Room detail fetched successfully.")
        return card
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching room detail: {e}")
        raise Exception(f"Database error while fetching room detail: {e}")


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
