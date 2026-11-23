"""Resident profile: own profile, own room, guardian-phone edit.

The resident id is always taken from the JWT. Any other id in the
request is ignored, so a resident can never see another resident.
"""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_resident
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.schemas.resident.profile import EditProfileRequest
from app.services.resident import edit_profile_service, profile_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/resident", tags=["resident-profile"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.get("/me", dependencies=[Depends(JWTBearer())])
async def get_me(request: Request, current_user: User = Depends(get_current_resident), db: AsyncSession = Depends(get_db)):
    """Return the logged-in resident's own profile."""
    try:
        logger.info("Entering into get resident me API")
        data = await profile_service.get_me(db, current_user)
        logger.info("Task completed in get resident me API")
        return _ok("Profile fetched successfully", data)
    except Exception as e:
        logger.error(f"Failed to fetch profile: {e}", exc_info=True)
        return _fail("Failed to fetch profile")


@router.get("/my-room", dependencies=[Depends(JWTBearer())])
async def get_my_room(request: Request, current_user: User = Depends(get_current_resident), db: AsyncSession = Depends(get_db)):
    """Return the logged-in resident's own room."""
    try:
        logger.info("Entering into get my room API")
        data = await profile_service.get_my_room(db, current_user)
        logger.info("Task completed in get my room API")
        return _ok("Room fetched successfully", data)
    except LookupError:
        return _fail("Resident profile not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch room: {e}", exc_info=True)
        return _fail("Failed to fetch room")


@router.put("/profile", dependencies=[Depends(JWTBearer())])
async def update_profile(request: Request, payload: EditProfileRequest, current_user: User = Depends(get_current_resident), db: AsyncSession = Depends(get_db)):
    """Edit own profile. Guardian phone changes directly; name/phone
    changes need admin approval (Phase 2 flow) and are not applied here.
    """
    try:
        logger.info("Entering into update profile API")
        if payload.guardian_phone:
            data = await profile_service.update_guardian_phone(db, current_user, payload.guardian_phone)
            logger.info("Task completed in update profile API")
            return _ok("Profile updated successfully", data)
        logger.info("Task completed in update profile API")
        return _ok("Name or phone change needs admin approval", {"needs_approval": True})
    except LookupError:
        return _fail("Resident profile not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to update profile: {e}", exc_info=True)
        return _fail("Failed to update profile")


@router.post("/profile/edit-request", dependencies=[Depends(JWTBearer())])
async def submit_edit_request(request: Request, payload: EditProfileRequest, current_user: User = Depends(get_current_resident), db: AsyncSession = Depends(get_db)):
    """Submit a profile edit request.

    Guardian-only changes are applied immediately. Name / phone / CNIC
    changes are stored as pending and need admin approval.
    """
    try:
        logger.info("Entering into submit edit request API")
        data = await edit_profile_service.submit_edit_request(db, current_user, payload)
        logger.info("Task completed in submit edit request API")
        return _ok("Edit request submitted successfully", data, status.HTTP_201_CREATED)
    except LookupError:
        return _fail("Resident profile not found", status.HTTP_404_NOT_FOUND)
    except ValueError:
        return _fail("At least one field is required", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to submit edit request: {e}", exc_info=True)
        return _fail("Failed to submit edit request")


@router.get("/profile/edit-requests", dependencies=[Depends(JWTBearer())])
async def list_own_edit_requests(request: Request, current_user: User = Depends(get_current_resident), db: AsyncSession = Depends(get_db)):
    """List the logged-in resident's own edit requests."""
    try:
        logger.info("Entering into list own edit requests API")
        data = await edit_profile_service.list_own_requests(db, current_user)
        logger.info("Task completed in list own edit requests API")
        return _ok("Edit requests fetched successfully", data)
    except LookupError:
        return _fail("Resident profile not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch edit requests: {e}", exc_info=True)
        return _fail("Failed to fetch edit requests")
