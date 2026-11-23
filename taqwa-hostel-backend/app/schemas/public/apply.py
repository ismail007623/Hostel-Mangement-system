"""Public schemas: onboarding application (invite link / public apply)."""

from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import CNIC_PATTERN, PHONE_PATTERN


class OnboardingRequest(BaseModel):
    """Onboarding form. Creates a PENDING application, not a login yet."""

    full_name: str = Field(min_length=3, max_length=200)
    father_name: str = Field(min_length=3, max_length=200)
    phone: str = Field(pattern=PHONE_PATTERN)
    guardian_phone: str = Field(pattern=PHONE_PATTERN)
    cnic_number: str = Field(pattern=CNIC_PATTERN)
    password: str = Field(min_length=6, max_length=100)
    start_date: date
    monthly_rent: int = Field(gt=0)
    security_paid: int = Field(ge=0, default=0)


class InviteCreate(BaseModel):
    """Admin creates an invite link for one phone number."""

    phone: str = Field(pattern=PHONE_PATTERN)
    full_name: str | None = Field(default=None, max_length=200)


class ApplicationResponse(BaseModel):
    """An application row for the admin list."""

    id: int
    full_name: str
    phone: str
    cnic_number: str
    start_date: date
    monthly_rent: int
    security_paid: int
    status: str
