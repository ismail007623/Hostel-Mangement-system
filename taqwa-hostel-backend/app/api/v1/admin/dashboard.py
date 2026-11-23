"""Admin dashboard: total residents, seats, buildings, rooms."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.services.admin import building_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin", tags=["admin-dashboard"])


@router.get("/dashboard", dependencies=[Depends(JWTBearer())])
async def get_dashboard(
    request: Request,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return dashboard counts for the admin's hostel."""
    try:
        logger.info("Entering into get dashboard API")
        data = await building_service.get_dashboard(db, current_user.hostel_id)
        logger.info("Task completed in get dashboard API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_200_OK, "message": "Dashboard fetched successfully", "data": data},
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        logger.error(f"Failed to fetch dashboard: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to fetch dashboard", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
