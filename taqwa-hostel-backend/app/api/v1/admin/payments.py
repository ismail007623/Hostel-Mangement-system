"""Admin payments: list, view, approve, reject (Phase 2)."""

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.schemas.admin.payment import RejectPaymentRequest
from app.services.admin import payment_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin/payments", tags=["admin-payments"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.get("", dependencies=[Depends(JWTBearer())])
async def list_payments(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List payments in the admin's hostel, optionally by status."""
    try:
        logger.info("Entering into list payments API")
        data = await payment_service.list_payments(db, current_user.hostel_id, status_filter)
        logger.info("Task completed in list payments API")
        return _ok("Payments fetched successfully", data)
    except ValueError:
        return _fail("Invalid payment status", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to fetch payments: {e}", exc_info=True)
        return _fail("Failed to fetch payments")


@router.get("/{payment_id}", dependencies=[Depends(JWTBearer())])
async def get_payment(
    request: Request,
    payment_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return one payment with its screenshot and cycle details."""
    try:
        logger.info("Entering into get payment API")
        data = await payment_service.get_payment(db, current_user.hostel_id, payment_id)
        logger.info("Task completed in get payment API")
        return _ok("Payment fetched successfully", data)
    except LookupError:
        return _fail("Payment not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch payment: {e}", exc_info=True)
        return _fail("Failed to fetch payment")


@router.post("/{payment_id}/approve", dependencies=[Depends(JWTBearer())])
async def approve_payment(
    request: Request,
    payment_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending payment and update its rent cycle."""
    try:
        logger.info("Entering into approve payment API")
        data = await payment_service.approve_payment(db, current_user.hostel_id, payment_id, current_user.id)
        logger.info("Task completed in approve payment API")
        return _ok("Payment approved successfully", data)
    except LookupError:
        return _fail("Payment not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Payment cannot be approved", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to approve payment: {e}", exc_info=True)
        return _fail("Failed to approve payment")


@router.post("/{payment_id}/reject", dependencies=[Depends(JWTBearer())])
async def reject_payment(
    request: Request,
    payment_id: int,
    payload: RejectPaymentRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending payment. The rent cycle is unchanged."""
    try:
        logger.info("Entering into reject payment API")
        data = await payment_service.reject_payment(db, current_user.hostel_id, payment_id, current_user.id, payload.reason)
        logger.info("Task completed in reject payment API")
        return _ok("Payment rejected successfully", data)
    except LookupError:
        return _fail("Payment not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Payment cannot be rejected", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to reject payment: {e}", exc_info=True)
        return _fail("Failed to reject payment")
