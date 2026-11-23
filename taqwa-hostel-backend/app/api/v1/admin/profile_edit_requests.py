"""Admin profile-edit requests: list, approve, reject (Phase 2)."""

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.schemas.admin.payment import RejectEditRequest
from app.services.resident import edit_profile_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin/profile-edit-requests", tags=["admin-profile-edits"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.get("", dependencies=[Depends(JWTBearer())])
async def list_edit_requests(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List profile-edit requests in the admin's hostel."""
    try:
        logger.info("Entering into list profile edit requests API")
        data = await edit_profile_service.list_requests(db, current_user.hostel_id, status_filter)
        logger.info("Task completed in list profile edit requests API")
        return _ok("Edit requests fetched successfully", data)
    except ValueError:
        return _fail("Invalid status filter", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to fetch edit requests: {e}", exc_info=True)
        return _fail("Failed to fetch edit requests")


@router.post("/{request_id}/approve", dependencies=[Depends(JWTBearer())])
async def approve_edit_request(
    request: Request,
    request_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending edit request and apply the changes."""
    try:
        logger.info("Entering into approve edit request API")
        data = await edit_profile_service.approve_request(db, current_user.hostel_id, request_id, current_user.id)
        logger.info("Task completed in approve edit request API")
        return _ok("Edit request approved successfully", data)
    except LookupError:
        return _fail("Edit request not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Edit request cannot be approved", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to approve edit request: {e}", exc_info=True)
        return _fail("Failed to approve edit request")


@router.post("/{request_id}/reject", dependencies=[Depends(JWTBearer())])
async def reject_edit_request(
    request: Request,
    request_id: int,
    payload: RejectEditRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending edit request. Nothing is changed."""
    try:
        logger.info("Entering into reject edit request API")
        data = await edit_profile_service.reject_request(db, current_user.hostel_id, request_id, current_user.id, payload.reason)
        logger.info("Task completed in reject edit request API")
        return _ok("Edit request rejected successfully", data)
    except LookupError:
        return _fail("Edit request not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Edit request cannot be rejected", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to reject edit request: {e}", exc_info=True)
        return _fail("Failed to reject edit request")
