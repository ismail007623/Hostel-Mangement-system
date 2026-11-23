"""Authentication: password hashing, JWT, and role guards.

Rules:
- Role is never taken from the client. It is read from the database
  user row and copied into the JWT at login time.
- ``JWTBearer`` only verifies the token; role checks live in
  ``get_current_admin`` / ``get_current_resident`` in ``app/api/deps.py``.
- Refresh tokens are stored only as a bcrypt hash, never in plain text.
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt.

    Args:
        password: Plain-text password (never logged or stored).

    Returns:
        The bcrypt hash string.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plain-text password against a stored hash."""
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token with SHA-256 for storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_token(data: dict[str, Any], expires: timedelta) -> str:
    """Create a signed JWT with an expiry."""
    payload = dict(data)
    payload["exp"] = datetime.now(timezone.utc) + expires
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, hostel_id: int, role: str) -> str:
    """Create a short-lived access token (default 60 minutes)."""
    return _create_token(
        {"sub": str(user_id), "hostel_id": hostel_id, "role": role, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: int) -> str:
    """Create a long-lived refresh token (default 7 days)."""
    return _create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT.

    Raises:
        HTTPException: 401 when the token is expired or invalid.
    """
    try:
        return jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from None


class JWTBearer(HTTPBearer):
    """Bearer-token guard for protected routes.

    Verifies the token and returns its payload. Role checks are done
    separately in ``app/api/deps.py`` so a valid token alone never
    grants admin access.
    """

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> dict[str, Any]:
        """Validate the Authorization header and return the token payload."""
        credentials = await super().__call__(request)
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header missing",
            )
        return decode_token(credentials.credentials)


async def get_user_from_payload(db: AsyncSession, payload: dict[str, Any]):
    """Load the user row for a decoded token payload.

    Args:
        db: Async database session.
        payload: Decoded JWT payload.

    Returns:
        The ``User`` row, or ``None`` when it does not exist / is inactive.
    """
    from app.models.user import User

    try:
        logger.info("Fetching user from DB")
        user_id = int(payload.get("sub", 0))
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if user is None or not user.is_active:
            return None
        logger.info("User fetched successfully.")
        return user
    except (TypeError, ValueError):
        return None
    except Exception as e:
        logger.error(f"Database error while fetching user: {e}")
        raise Exception(f"Database error while fetching user: {e}")
