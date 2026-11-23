"""Public onboarding apply (no login). Creates a PENDING application."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging_config import get_logger
from app.models.hostel import Hostel
from app.schemas.public.apply import OnboardingRequest
from app.services.admin import resident_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/public", tags=["public"])


@router.post("/apply")
async def apply(request: Request, payload: OnboardingRequest, db: AsyncSession = Depends(get_db)):
    """Submit an onboarding application. Login is only after approval."""
    try:
        logger.info("Entering into public apply API")
        result = await db.execute(select(Hostel).order_by(Hostel.id))
        hostel = result.scalars().first()
        if hostel is None:
            return JSONResponse(
                content={"succeed": False, "status": status.HTTP_404_NOT_FOUND, "message": "Hostel not found", "data": None},
                status_code=status.HTTP_404_NOT_FOUND,
            )
        token = request.query_params.get("token")
        data = await resident_service.create_application(db, hostel.id, payload, token)
        logger.info("Task completed in public apply API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_201_CREATED, "message": "Application submitted successfully", "data": data},
            status_code=status.HTTP_201_CREATED,
        )
    except ValueError:
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_400_BAD_REQUEST, "message": "Phone or CNIC already registered", "data": None},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        logger.error(f"Failed to submit application: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to submit application", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
