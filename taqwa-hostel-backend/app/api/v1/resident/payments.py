"""Resident payments: submit rent with a screenshot (Phase 2).

Multipart form: rent_cycle_id, amount, method, screenshot file.
Only png / jpg / jpeg, max 5MB. Submitting never changes the rent
cycle; the cycle changes only when the admin approves the payment.
"""

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_resident
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.payment import PaymentMethod
from app.models.user import User
from app.services.admin import payment_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/resident/payments", tags=["resident-payments"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.post("", dependencies=[Depends(JWTBearer())])
async def submit_payment(
    request: Request,
    rent_cycle_id: int = Form(...),
    amount: int = Form(gt=0),
    method: str = Form(...),
    screenshot: UploadFile = File(...),
    current_user: User = Depends(get_current_resident),
    db: AsyncSession = Depends(get_db),
):
    """Submit a rent payment with a screenshot for admin approval."""
    try:
        logger.info("Entering into submit payment API")
        if method not in [m.value for m in PaymentMethod]:
            return _fail("Invalid payment method", status.HTTP_400_BAD_REQUEST)
        file_bytes = await screenshot.read()
        data = await payment_service.submit_payment(
            db,
            current_user,
            rent_cycle_id,
            amount,
            method,
            screenshot.filename,
            screenshot.content_type,
            file_bytes,
        )
        logger.info("Task completed in submit payment API")
        return _ok("Payment submitted successfully", data, status.HTTP_201_CREATED)
    except LookupError:
        return _fail("Rent cycle not found", status.HTTP_404_NOT_FOUND)
    except PermissionError:
        return _fail("This rent cycle belongs to another resident", status.HTTP_403_FORBIDDEN)
    except ValueError as exc:
        message = str(exc)
        if "more than the remaining rent" in message:
            return _fail("Amount is more than the remaining rent", status.HTTP_400_BAD_REQUEST)
        if "already fully paid" in message:
            return _fail("This rent cycle is already fully paid", status.HTTP_400_BAD_REQUEST)
        logger.error(f"Failed to submit payment: {exc}")
        return _fail("Payment could not be submitted", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to submit payment: {e}", exc_info=True)
        return _fail("Failed to submit payment")
