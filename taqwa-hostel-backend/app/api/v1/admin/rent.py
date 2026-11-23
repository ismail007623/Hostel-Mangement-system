"""Admin rent lists: who still has to pay, who already paid (Phase 2)."""

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.services.admin import payment_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin/rent", tags=["admin-rent"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.get("/due-list", dependencies=[Depends(JWTBearer())])
async def due_list(
    request: Request,
    status_filter: str = Query(default="all", alias="status"),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List residents with an open rent cycle.

    Query ``status`` is due, overdue, due_soon or all. Each row has a
    wa.me link so Qari can send a reminder by hand (no WhatsApp API).
    """
    try:
        logger.info("Entering into due list API")
        data = await payment_service.get_due_list(db, current_user.hostel_id, status_filter)
        logger.info("Task completed in due list API")
        return _ok("Due list fetched successfully", data)
    except ValueError:
        return _fail("Invalid status filter", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to fetch due list: {e}", exc_info=True)
        return _fail("Failed to fetch due list")


@router.get("/paid-list", dependencies=[Depends(JWTBearer())])
async def paid_list(
    request: Request,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List fully-paid rent cycles, newest first."""
    try:
        logger.info("Entering into paid list API")
        data = await payment_service.get_paid_list(db, current_user.hostel_id)
        logger.info("Task completed in paid list API")
        return _ok("Paid list fetched successfully", data)
    except Exception as e:
        logger.error(f"Failed to fetch paid list: {e}", exc_info=True)
        return _fail("Failed to fetch paid list")
