"""Auth service: login and refresh-token rotation.

Login decides the role from the database row. The client never sends
a role. Refresh tokens are stored only as a SHA-256 hash.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    verify_password,
)
from app.models.user import User

logger = get_logger(__name__)


async def login(db: AsyncSession, phone: str, password: str) -> dict:
    """Verify phone + password and issue access + refresh tokens.

    Args:
        db: Async database session.
        phone: Login phone number.
        password: Plain-text password (never logged).

    Returns:
        Token payload with role, user id, hostel id, and name.

    Raises:
        LookupError: When the user does not exist or is inactive.
        ValueError: When the password is wrong.
    """
    try:
        logger.info("Fetching user from DB for login")
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalars().first()
        if user is None or not user.is_active:
            raise LookupError("Invalid phone or password")
        if not verify_password(password, user.password_hash):
            raise ValueError("Invalid phone or password")
        access = create_access_token(user.id, user.hostel_id, user.role)
        refresh = create_refresh_token(user.id)
        user.refresh_token_hash = hash_refresh_token(refresh)
        await db.commit()
        logger.info("User logged in successfully.")
        return {
            "access_token": access,
            "refresh_token": refresh,
            "role": user.role,
            "user_id": user.id,
            "hostel_id": user.hostel_id,
            "full_name": user.full_name,
        }
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while logging in user: {e}")
        raise Exception(f"Database error while logging in user: {e}")


async def refresh(db: AsyncSession, refresh_token: str) -> dict:
    """Rotate a refresh token and issue a new token pair."""
    try:
        logger.info("Fetching user from DB for token refresh")
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        result = await db.execute(select(User).where(User.id == int(payload["sub"])))
        user = result.scalars().first()
        if user is None or not user.is_active:
            raise LookupError("Invalid refresh token")
        if user.refresh_token_hash != hash_refresh_token(refresh_token):
            raise ValueError("Invalid refresh token")
        access = create_access_token(user.id, user.hostel_id, user.role)
        new_refresh = create_refresh_token(user.id)
        user.refresh_token_hash = hash_refresh_token(new_refresh)
        await db.commit()
        logger.info("Token refreshed successfully.")
        return {
            "access_token": access,
            "refresh_token": new_refresh,
            "role": user.role,
            "user_id": user.id,
            "hostel_id": user.hostel_id,
            "full_name": user.full_name,
        }
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while refreshing token: {e}")
        raise Exception(f"Database error while refreshing token: {e}")
