"""Shared dependencies: load the current user and enforce roles.

Role is read from the database user row (via the JWT subject), never
from the client. A resident can only ever see their own record.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import JWTBearer, get_user_from_payload
from app.models.user import User, UserRole

logger = get_logger(__name__)


async def get_current_user(
    payload: dict = Depends(JWTBearer()),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Return the logged-in user, or raise 401."""
    try:
        logger.info("Fetching current user from DB")
        user = await get_user_from_payload(db, payload)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
        logger.info("Current user fetched successfully.")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching current user: {e}")
        raise Exception(f"Database error while fetching current user: {e}")


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Return the user only when their role is admin, else 403."""
    try:
        logger.info("Checking admin role")
        if current_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
        logger.info("Admin role verified successfully.")
        return current_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error while checking admin role: {e}")
        raise Exception(f"Error while checking admin role: {e}")


async def get_current_resident(current_user: User = Depends(get_current_user)) -> User:
    """Return the user only when their role is resident, else 403."""
    try:
        logger.info("Checking resident role")
        if current_user.role != UserRole.RESIDENT.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Resident only")
        logger.info("Resident role verified successfully.")
        return current_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error while checking resident role: {e}")
        raise Exception(f"Error while checking resident role: {e}")
