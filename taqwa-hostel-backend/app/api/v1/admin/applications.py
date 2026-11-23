"""Admin application endpoints: invite, list, approve, reject."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.schemas.public.apply import InviteCreate
from app.services.admin import resident_service
from pydantic import BaseModel, Field

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin/applications", tags=["admin-applications"])


class ApproveRequest(BaseModel):
    """Approve an application and assign a vacant seat."""

    seat_id: int


class RejectRequest(BaseModel):
    """Reject an application with an optional reason."""

    reason: str | None = Field(default=None, max_length=500)


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.post("/invite", dependencies=[Depends(JWTBearer())])
async def create_invite(request: Request, payload: InviteCreate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Create an invite link. Qari sends the link on WhatsApp himself."""
    try:
        logger.info("Entering into create invite API")
        data = await resident_service.create_invite(db, current_user.hostel_id, payload)
        logger.info("Task completed in create invite API")
        return _ok("Invite created successfully", data, status.HTTP_201_CREATED)
    except ValueError:
        return _fail("Phone already registered", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create invite: {e}", exc_info=True)
        return _fail("Failed to create invite")


@router.get("", dependencies=[Depends(JWTBearer())])
async def list_applications(request: Request, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """List applications in the admin's hostel."""
    try:
        logger.info("Entering into list applications API")
        data = await resident_service.list_applications(db, current_user.hostel_id)
        logger.info("Task completed in list applications API")
        return _ok("Applications fetched successfully", data)
    except Exception as e:
        logger.error(f"Failed to fetch applications: {e}", exc_info=True)
        return _fail("Failed to fetch applications")


@router.post("/{application_id}/approve", dependencies=[Depends(JWTBearer())])
async def approve_application(request: Request, application_id: int, payload: ApproveRequest, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Approve an application and assign a seat (creates login + resident)."""
    try:
        logger.info("Entering into approve application API")
        data = await resident_service.approve_application(db, current_user.hostel_id, application_id, payload.seat_id)
        logger.info("Task completed in approve application API")
        return _ok("Application approved successfully", data)
    except LookupError:
        return _fail("Application not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Application cannot be approved", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to approve application: {e}", exc_info=True)
        return _fail("Failed to approve application")


@router.post("/{application_id}/reject", dependencies=[Depends(JWTBearer())])
async def reject_application(request: Request, application_id: int, payload: RejectRequest, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Reject a pending application."""
    try:
        logger.info("Entering into reject application API")
        data = await resident_service.reject_application(db, current_user.hostel_id, application_id, payload.reason)
        logger.info("Task completed in reject application API")
        return _ok("Application rejected successfully", data)
    except LookupError:
        return _fail("Application not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("Application cannot be rejected", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to reject application: {e}", exc_info=True)
        return _fail("Failed to reject application")
