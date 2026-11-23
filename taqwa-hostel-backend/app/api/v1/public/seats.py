"""Public vacant-seat counts (no login, no names or phones)."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging_config import get_logger
from app.services.public import hostel_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/public", tags=["public"])


@router.get("/seats")
async def get_seats(request: Request, db: AsyncSession = Depends(get_db)):
    """Return vacant seat counts per building and room type."""
    try:
        logger.info("Entering into get public seats API")
        data = await hostel_service.get_vacant_seats(db)
        logger.info("Task completed in get public seats API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_200_OK, "message": "Seats fetched successfully", "data": data},
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        logger.error(f"Failed to fetch seats: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to fetch seats", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/seats/by-room")
async def get_seats_by_room(request: Request, db: AsyncSession = Depends(get_db)):
    """Return vacant seat counts per room (Phase 3 landing seat map)."""
    try:
        logger.info("Entering into get public seats by room API")
        data = await hostel_service.get_vacant_seats_by_room(db)
        logger.info("Task completed in get public seats by room API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_200_OK, "message": "Seats fetched successfully", "data": data},
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        logger.error(f"Failed to fetch seats by room: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to fetch seats", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
