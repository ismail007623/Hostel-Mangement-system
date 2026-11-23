"""Auth schemas: login, refresh, and the current-user response."""

from pydantic import BaseModel, Field

from app.schemas.common import PHONE_PATTERN


class LoginRequest(BaseModel):
    """Login payload. Role is never in the payload; it comes from the DB."""

    phone: str = Field(pattern=PHONE_PATTERN, description="Pakistani mobile, 03XXXXXXXXX")
    password: str = Field(min_length=6, max_length=100)


class RefreshRequest(BaseModel):
    """Refresh-token payload."""

    refresh_token: str = Field(min_length=10)


class TokenResponse(BaseModel):
    """Tokens returned on login / refresh."""

    access_token: str
    refresh_token: str
    role: str
    user_id: int
    hostel_id: int
    full_name: str


class MeResponse(BaseModel):
    """Current-user info for GET /auth/me."""

    user_id: int
    hostel_id: int
    role: str
    full_name: str
    phone: str
