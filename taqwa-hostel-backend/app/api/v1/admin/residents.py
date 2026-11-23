"""Admin resident endpoints: manual add, list (search + pagination),
person card, CSV export, and extra charges."""

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer
from app.models.user import User
from app.schemas.admin.extra_charge import ExtraChargeCreate, ExtraChargeUpdate
from app.schemas.admin.resident import ResidentCreate
from app.services.admin import extra_charge_service, resident_service
from pydantic import BaseModel

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/admin/residents", tags=["admin-residents"])


class ToggleRequest(BaseModel):
    """Switch an extra charge on or off."""

    is_active: bool


def _ok(message: str, data, code: int = status.HTTP_200_OK):
    """Build a success envelope response."""
    return JSONResponse(content={"succeed": True, "status": code, "message": message, "data": data}, status_code=code)


def _fail(message: str, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Build a generic failure envelope response."""
    return JSONResponse(content={"succeed": False, "status": code, "message": message, "data": None}, status_code=code)


@router.post("", dependencies=[Depends(JWTBearer())])
async def create_resident(request: Request, payload: ResidentCreate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Manually add a resident and assign a vacant seat.

    Optional ``extras`` (AC / Cooler / Geyser + amount each) are
    created with the resident, so the first rent cycle already
    includes them in its total.
    """
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
async def list_residents(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List residents, paginated. ?search= matches name, phone and CNIC."""
    try:
        logger.info("Entering into list residents API")
        data = await resident_service.list_residents(db, current_user.hostel_id, page, page_size, search)
        logger.info("Task completed in list residents API")
        return _ok("Residents fetched successfully", data)
    except Exception as e:
        logger.error(f"Failed to fetch residents: {e}", exc_info=True)
        return _fail("Failed to fetch residents")


@router.get("/export", dependencies=[Depends(JWTBearer())])
async def export_residents(
    request: Request,
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Download residents as CSV (admin only, same ?search= filter)."""
    try:
        logger.info("Entering into export residents API")
        csv_text = await resident_service.export_residents_csv(db, current_user.hostel_id, search)
        logger.info("Task completed in export residents API")
        return PlainTextResponse(
            csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=taqwa-residents.csv"},
        )
    except Exception as e:
        logger.error(f"Failed to export residents: {e}", exc_info=True)
        return _fail("Failed to export residents")


@router.get("/{resident_id}", dependencies=[Depends(JWTBearer())])
async def get_resident(request: Request, resident_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Return the person card for one resident (with extras + totals)."""
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


@router.get("/{resident_id}/extras", dependencies=[Depends(JWTBearer())])
async def list_extras(request: Request, resident_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """List a resident's extra charges (active + inactive)."""
    try:
        logger.info("Entering into list extras API")
        data = await extra_charge_service.list_extras(db, current_user.hostel_id, resident_id)
        logger.info("Task completed in list extras API")
        return _ok("Extra charges fetched successfully", data)
    except LookupError:
        return _fail("Resident not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to fetch extra charges: {e}", exc_info=True)
        return _fail("Failed to fetch extra charges")


@router.post("/{resident_id}/extras", dependencies=[Depends(JWTBearer())])
async def add_extra(request: Request, resident_id: int, payload: ExtraChargeCreate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Add an extra charge. It applies from the NEXT rent cycle only."""
    try:
        logger.info("Entering into add extra API")
        data = await extra_charge_service.add_extra(db, current_user.hostel_id, resident_id, payload)
        logger.info("Task completed in add extra API")
        return _ok("Extra charge added successfully", data, status.HTTP_201_CREATED)
    except LookupError:
        return _fail("Resident not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to add extra charge: {e}", exc_info=True)
        return _fail("Failed to add extra charge")


@router.put("/{resident_id}/extras/{charge_id}", dependencies=[Depends(JWTBearer())])
async def update_extra(request: Request, resident_id: int, charge_id: int, payload: ExtraChargeUpdate, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Update one extra charge (name / amount / dates)."""
    try:
        logger.info("Entering into update extra API")
        data = await extra_charge_service.update_extra(db, current_user.hostel_id, resident_id, charge_id, payload)
        logger.info("Task completed in update extra API")
        return _ok("Extra charge updated successfully", data)
    except LookupError:
        return _fail("Extra charge not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to update extra charge: {e}", exc_info=True)
        return _fail("Failed to update extra charge")


@router.post("/{resident_id}/extras/{charge_id}/toggle", dependencies=[Depends(JWTBearer())])
async def toggle_extra(request: Request, resident_id: int, charge_id: int, payload: ToggleRequest, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Switch an extra on/off. Applies from the NEXT rent cycle only."""
    try:
        logger.info("Entering into toggle extra API")
        data = await extra_charge_service.toggle_extra(db, current_user.hostel_id, resident_id, charge_id, payload.is_active)
        logger.info("Task completed in toggle extra API")
        return _ok("Extra charge updated successfully", data)
    except LookupError:
        return _fail("Extra charge not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to toggle extra charge: {e}", exc_info=True)
        return _fail("Failed to toggle extra charge")


@router.delete("/{resident_id}/extras/{charge_id}", dependencies=[Depends(JWTBearer())])
async def remove_extra(request: Request, resident_id: int, charge_id: int, current_user: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Remove an extra charge. Applies from the NEXT rent cycle only."""
    try:
        logger.info("Entering into remove extra API")
        data = await extra_charge_service.remove_extra(db, current_user.hostel_id, resident_id, charge_id)
        logger.info("Task completed in remove extra API")
        return _ok("Extra charge removed successfully", data)
    except LookupError:
        return _fail("Extra charge not found", status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Failed to remove extra charge: {e}", exc_info=True)
        return _fail("Failed to remove extra charge")
