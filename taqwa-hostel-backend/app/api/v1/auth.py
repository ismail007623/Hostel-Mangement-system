"""Central auth router: single login for admin and resident.

The backend decides the role from the database. The client never
sends a role. Frontend redirects by the returned ``role``:
admin -> /admin/dashboard, resident -> /resident/home.
"""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.models.user import User
from app.schemas.auth import LoginRequest, MeResponse, RefreshRequest, TokenResponse
from app.services import auth_service

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/login")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with phone + password. Role comes from the database."""
    try:
        logger.info("Entering into login API")
        data = await auth_service.login(db, payload.phone, payload.password)
        logger.info("Task completed in login API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_200_OK, "message": "Login successful", "data": data},
            status_code=status.HTTP_200_OK,
        )
    except (LookupError, ValueError):
        logger.error("Failed login attempt: invalid credentials")
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_401_UNAUTHORIZED, "message": "Invalid phone or password", "data": None},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    except Exception as e:
        logger.error(f"Failed to login: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to login", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.post("/refresh")
async def refresh(request: Request, payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Rotate a refresh token and get a new token pair."""
    try:
        logger.info("Entering into refresh token API")
        data = await auth_service.refresh(db, payload.refresh_token)
        logger.info("Task completed in refresh token API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_200_OK, "message": "Token refreshed successfully", "data": data},
            status_code=status.HTTP_200_OK,
        )
    except (LookupError, ValueError):
        logger.error("Failed token refresh: invalid token")
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_401_UNAUTHORIZED, "message": "Invalid refresh token", "data": None},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    except Exception as e:
        logger.error(f"Failed to refresh token: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to refresh token", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/me")
async def me(request: Request, current_user: User = Depends(get_current_user)):
    """Return the logged-in user's info (role decided by the backend)."""
    try:
        logger.info("Entering into get me API")
        data = {
            "user_id": current_user.id,
            "hostel_id": current_user.hostel_id,
            "role": current_user.role,
            "full_name": current_user.full_name,
            "phone": current_user.phone,
        }
        logger.info("Task completed in get me API")
        return JSONResponse(
            content={"succeed": True, "status": status.HTTP_200_OK, "message": "User fetched successfully", "data": data},
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        logger.error(f"Failed to fetch user: {e}", exc_info=True)
        return JSONResponse(
            content={"succeed": False, "status": status.HTTP_500_INTERNAL_SERVER_ERROR, "message": "Failed to fetch user", "data": None},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
