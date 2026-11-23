"""Admin resident endpoints: manual add, list, person card."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.schemas.admin.resident import ResidentCreate
from app.services.admin import resident_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin/residents", tags=["admin-residents"])


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response (no real error leaks)."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.post("", dependencies=[Depends(JWTBearer())])
async def create_resident(request: Request, payload: ResidentCreate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Manually add a resident and assign a vacant seat."""
    try:
        logger.info("Entering into create resident API")
        data = await resident_service.create_resident_manual(db, current_user.hostel_id, payload)
        logger.info("Task completed in create resident API")
        return _ok("Resident created successfully", data, status.HTTP_201_CREATED)
    except ValueError as e:
        logger.error(f"Failed to create resident: {e}")
        return _fail("Phone or CNIC already registered, or seat is not vacant", status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create resident: {e}", exc_info=True)
        return _fail("Failed to create resident")


@router.get("", dependencies=[Depends(JWTBearer())])
async def list_residents(request: Request, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """List all residents in the admin's hostel."""
    try:
        logger.info("Entering into list residents API")
        data = await resident_service.list_residents(db, current_user.hostel_id)
        logger.info("Task completed in list residents API")
        return _ok("Residents fetched successfully", data)
    except Exception as e:
        logger.error(f"Failed to fetch residents: {e}", exc_info=True)
        return _fail("Failed to fetch residents")


@router.get("/{resident_id}", dependencies=[Depends(JWTBearer())])
async def get_resident(request: Request, resident_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Return the person card for one resident."""
    try:
        logger.info("Entering into get resident API")
        data = await resident_service.get_resident(db, current_user.hostel_id, resident_id)
        logger.info("Task completed in get resident API")
        return _ok("Resident fetched successfully", data)
    except LookupError:
        return _fail("Resident not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch resident: {e}", exc_info=True)
        return _fail("Failed to fetch resident")
