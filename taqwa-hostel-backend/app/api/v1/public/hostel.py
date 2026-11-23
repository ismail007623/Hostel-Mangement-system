"""Public hostel info (no login, no private data)."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging_config import get_logger
from app.services.public import hostel_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/public", tags=["public"])


@router.get("/hostel")
async def get_hostel(request: Request, db: AsyncSession = Depends(get_db)):
    """Return public hostel info (name, address, contact phone)."""
    try:
        logger.info("Entering into get public hostel API")
        data = await hostel_service.get_hostel(db)
        logger.info("Task completed in get public hostel API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_200_OK, "message": "Hostel fetched successfully", "data": data},
            status_code=status.HTTP_200_OK,
        )
    except LookupError:
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_404_NOT_FOUND, "message": "Hostel not found", "data": None},
            status_code=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        logger.error(f"Failed to fetch hostel: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to fetch hostel", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
