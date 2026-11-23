"""Admin settings: rent duration (30), grace days, security standard."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.hostel import Hostel
from app.models.user import User

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin/settings", tags=["admin-settings"])


class SettingsUpdate(BaseModel):
    """Settings the admin (Qari) can change."""

    rent_duration_days: int = Field(ge=1, le=365, default=30)
    grace_days: int = Field(ge=0, le=30, default=3)
    security_standard: int = Field(ge=0, default=10000)


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


def _to_dict(hostel: Hostel) -> dict:
    """Serialize hostel settings."""
    return {
        "hostel_id": hostel.id,
        "rent_duration_days": hostel.rent_duration_days,
        "grace_days": hostel.grace_days,
        "security_standard": hostel.security_standard,
    }


@router.get("", dependencies=[Depends(JWTBearer())])
async def get_settings(request: Request, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Get the hostel's settings."""
    try:
        logger.info("Entering into get settings API")
        result = await db.execute(select(Hostel).where(Hostel.id == current_user.hostel_id))
        hostel = result.scalars().first()
        if hostel is None:
            return _fail("Hostel not found", status.HTTP_404_NOT_FOUND)
        logger.info("Task completed in get settings API")
        return _ok("Settings fetched successfully", _to_dict(hostel))
    except Exception as e:
        logger.error(f"Failed to fetch settings: {e}", exc_info=True)
        return _fail("Failed to fetch settings")


@router.put("", dependencies=[Depends(JWTBearer())])
async def update_settings(request: Request, payload: SettingsUpdate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Update rent duration, grace days, or security standard."""
    try:
        logger.info("Entering into update settings API")
        result = await db.execute(select(Hostel).where(Hostel.id == current_user.hostel_id))
        hostel = result.scalars().first()
        if hostel is None:
            return _fail("Hostel not found", status.HTTP_404_NOT_FOUND)
        hostel.rent_duration_days = payload.rent_duration_days
        hostel.grace_days = payload.grace_days
        hostel.security_standard = payload.security_standard
        await db.commit()
        await db.refresh(hostel)
        logger.info("Task completed in update settings API")
        return _ok("Settings updated successfully", _to_dict(hostel))
    except Exception as e:
        logger.error(f"Failed to update settings: {e}", exc_info=True)
        return _fail("Failed to update settings")
