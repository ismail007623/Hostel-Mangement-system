"""Admin buildings / portions / rooms / seats endpoints."""

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.schemas.admin.building import BuildingCreate, PortionCreate, RoomCreate, RoomCreateFlexible, RoomUpdate
from app.services.admin import building_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin", tags=["admin-buildings"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(
        content={"succeed": True, "status": code, "message": message, "data": data},
        status_code=code,
    )


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response (no real error leaks)."""
    return JSONResponse(
        content={"succeed": False, "status": code, "message": message, "data": None},
        status_code=code,
    )


@router.post("/buildings", dependencies=[Depends(JWTBearer())])
async def create_building(request: Request, payload: BuildingCreate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Create a building in the admin's hostel."""
    try:
        logger.info("Entering into create building API")
        data = await building_service.create_building(db, current_user.hostel_id, payload)
        logger.info("Task completed in create building API")
        return _ok("Building created successfully", data, status.HTTP_201_CREATED)
    except ValueError:
        return _fail("Building already exists", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create building: {e}", exc_info=True)
        return _fail("Failed to create building")


@router.get("/buildings", dependencies=[Depends(JWTBearer())])
async def list_buildings(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List buildings, paginated (?page=&page_size=, default 20)."""
    try:
        logger.info("Entering into list buildings API")
        data = await building_service.list_buildings(db, current_user.hostel_id, page, page_size)
        logger.info("Task completed in list buildings API")
        return _ok("Buildings fetched successfully", data)
    except Exception as e:
        logger.error(f"Failed to fetch buildings: {e}", exc_info=True)
        return _fail("Failed to fetch buildings")


@router.post("/buildings/{building_id}/portions", dependencies=[Depends(JWTBearer())])
async def create_portion(request: Request, building_id: int, payload: PortionCreate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Create a portion inside a building."""
    try:
        logger.info("Entering into create portion API")
        data = await building_service.create_portion(db, current_user.hostel_id, building_id, payload)
        logger.info("Task completed in create portion API")
        return _ok("Portion created successfully", data, status.HTTP_201_CREATED)
    except LookupError:
        return _fail("Building not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Portion already exists", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create portion: {e}", exc_info=True)
        return _fail("Failed to create portion")


@router.get("/buildings/{building_id}/portions", dependencies=[Depends(JWTBearer())])
async def list_portions(request: Request, building_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """List portions of a building (empty when the building has none)."""
    try:
        logger.info("Entering into list portions API")
        data = await building_service.list_portions(db, current_user.hostel_id, building_id)
        logger.info("Task completed in list portions API")
        return _ok("Portions fetched successfully", data)
    except LookupError:
        return _fail("Building not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch portions: {e}", exc_info=True)
        return _fail("Failed to fetch portions")


@router.post("/buildings/{building_id}/rooms", dependencies=[Depends(JWTBearer())])
async def create_room(request: Request, building_id: int, payload: RoomCreate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Create a room; seats are auto-created from its room type."""
    try:
        logger.info("Entering into create room API")
        data = await building_service.create_room(db, current_user.hostel_id, building_id, payload)
        logger.info("Task completed in create room API")
        return _ok("Room created successfully", data, status.HTTP_201_CREATED)
    except LookupError:
        return _fail("Building or portion not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Room number already exists in this building", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create room: {e}", exc_info=True)
        return _fail("Failed to create room")


@router.post("/rooms", dependencies=[Depends(JWTBearer())])
async def create_room_flexible(request: Request, payload: RoomCreateFlexible, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Create a room with an OPTIONAL building.

    Blank building + exactly one building -> that building.
    Blank building + no building -> a "Main Building" is auto-created.
    Blank building + several buildings -> 400, pick one.
    """
    try:
        logger.info("Entering into create room (flexible) API")
        data = await building_service.create_room_flexible(db, current_user.hostel_id, payload)
        logger.info("Task completed in create room (flexible) API")
        return _ok("Room created successfully", data, status.HTTP_201_CREATED)
    except LookupError:
        return _fail("Building or portion not found", status.HTTP_404_NOT_FOUND)
    except ValueError as e:
        return _fail(str(e) if "pick a building" in str(e) else "Room number already exists in this building", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create room: {e}", exc_info=True)
        return _fail("Failed to create room")


@router.get("/rooms", dependencies=[Depends(JWTBearer())])
async def list_all_rooms(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all rooms of the hostel as room cards, paginated."""
    try:
        logger.info("Entering into list all rooms API")
        data = await building_service.list_all_rooms(db, current_user.hostel_id, page, page_size)
        logger.info("Task completed in list all rooms API")
        return _ok("Rooms fetched successfully", data)
    except Exception as e:
        logger.error(f"Failed to fetch rooms: {e}", exc_info=True)
        return _fail("Failed to fetch rooms")


@router.get("/buildings/{building_id}/rooms", dependencies=[Depends(JWTBearer())])
async def list_rooms(
    request: Request,
    building_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List rooms of a building as room cards, paginated."""
    try:
        logger.info("Entering into list rooms API")
        data = await building_service.list_rooms(db, current_user.hostel_id, building_id, page, page_size)
        logger.info("Task completed in list rooms API")
        return _ok("Rooms fetched successfully", data)
    except LookupError:
        return _fail("Building not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch rooms: {e}", exc_info=True)
        return _fail("Failed to fetch rooms")


@router.get("/rooms/{room_id}", dependencies=[Depends(JWTBearer())])
async def get_room(request: Request, room_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Return one room card with seats and each resident's extras."""
    try:
        logger.info("Entering into get room API")
        data = await building_service.get_room_detail(db, current_user.hostel_id, room_id)
        logger.info("Task completed in get room API")
        return _ok("Room fetched successfully", data)
    except LookupError:
        return _fail("Room not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch room: {e}", exc_info=True)
        return _fail("Failed to fetch room")


@router.put("/rooms/{room_id}", dependencies=[Depends(JWTBearer())])
async def update_room(request: Request, room_id: int, payload: RoomUpdate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Edit a room (number, type, portion). No floor field exists."""
    try:
        logger.info("Entering into update room API")
        data = await building_service.update_room(db, current_user.hostel_id, room_id, payload)
        logger.info("Task completed in update room API")
        return _ok("Room updated successfully", data)
    except LookupError:
        return _fail("Room or portion not found", status.HTTP_404_NOT_FOUND)
    except ValueError as e:
        return _fail(str(e), status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to update room: {e}", exc_info=True)
        return _fail("Failed to update room")


@router.get("/rooms/{room_id}/seats", dependencies=[Depends(JWTBearer())])
async def list_seats(request: Request, room_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """List seats of a room."""
    try:
        logger.info("Entering into list seats API")
        data = await building_service.list_seats(db, current_user.hostel_id, room_id)
        logger.info("Task completed in list seats API")
        return _ok("Seats fetched successfully", data)
    except LookupError:
        return _fail("Room not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch seats: {e}", exc_info=True)
        return _fail("Failed to fetch seats")


@router.get("/rooms/{room_id}/residents", dependencies=[Depends(JWTBearer())])
async def list_room_residents(request: Request, room_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """List residents living in one room."""
    try:
        logger.info("Entering into list room residents API")
        data = await building_service.list_room_residents(db, current_user.hostel_id, room_id)
        logger.info("Task completed in list room residents API")
        return _ok("Room residents fetched successfully", data)
    except LookupError:
        return _fail("Room not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch room residents: {e}", exc_info=True)
        return _fail("Failed to fetch room residents")
