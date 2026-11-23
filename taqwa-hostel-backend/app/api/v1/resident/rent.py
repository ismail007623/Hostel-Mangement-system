"""Resident rent: history and current cycle (Phase 2).

The resident id is always taken from the JWT. A resident can only
ever see their own cycles and payments.
"""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_resident
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.payment import Payment
from app.models.resident import Resident
from app.models.user import User
from app.services.admin import payment_service
from app.services.resident import rent_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/resident", tags=["resident-rent"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.get("/rent-history", dependencies=[Depends(JWTBearer())])
async def rent_history(request: Request, current_user: User = Depends(get_current_resident), db: AsyncSession = Depends(get_db)):
    """Return the resident's own rent cycles and payments."""
    try:
        logger.info("Entering into rent history API")
        result = await db.execute(select(Resident).where(Resident.user_id == current_user.id))
        resident = result.scalars().first()
        if resident is None:
            return _fail("Resident profile not found", status.HTTP_404_NOT_FOUND)
        cycles = await rent_service.list_cycles_for_resident(db, resident.id)
        payments = await payment_service.list_payments_for_resident(db, resident.id)
        logger.info("Task completed in rent history API")
        return _ok("Rent history fetched successfully", {"cycles": cycles, "payments": payments})
    except Exception as e:
        logger.error(f"Failed to fetch rent history: {e}", exc_info=True)
        return _fail("Failed to fetch rent history")


@router.get("/rent/current", dependencies=[Depends(JWTBearer())])
async def current_rent(request: Request, current_user: User = Depends(get_current_resident), db: AsyncSession = Depends(get_db)):
    """Return the resident's current rent cycle (due date, remaining, status)."""
    try:
        logger.info("Entering into current rent API")
        result = await db.execute(select(Resident).where(Resident.user_id == current_user.id))
        resident = result.scalars().first()
        if resident is None:
            return _fail("Resident profile not found", status.HTTP_404_NOT_FOUND)
        cycle = await rent_service.get_current_cycle(db, resident.id)
        if cycle is None:
            return _fail("No rent cycle found", status.HTTP_404_NOT_FOUND)
        logger.info("Task completed in current rent API")
        return _ok("Current rent fetched successfully", await rent_service.serialize_cycle(db, cycle))
    except Exception as e:
        logger.error(f"Failed to fetch current rent: {e}", exc_info=True)
        return _fail("Failed to fetch current rent")
