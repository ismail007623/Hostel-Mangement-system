"""Admin schemas for residents (manual add + person card)."""

from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import CNIC_PATTERN, PHONE_PATTERN


class ResidentCreate(BaseModel):
    """Manual add by the admin. Seat must be vacant; it becomes occupied."""

    full_name: str = Field(min_length=3, max_length=200)
    father_name: str = Field(min_length=3, max_length=200)
    phone: str = Field(pattern=PHONE_PATTERN)
    guardian_phone: str = Field(pattern=PHONE_PATTERN)
    cnic_number: str = Field(pattern=CNIC_PATTERN)
    password: str = Field(min_length=6, max_length=100)
    start_date: date
    monthly_rent: int = Field(gt=0)
    security_paid: int = Field(ge=0, default=0)
    seat_id: int


class ResidentResponse(BaseModel):
    """A resident row for list views."""

    id: int
    full_name: str
    phone: str
    monthly_rent: int
    security_paid: int
    start_date: date
    next_due_date: date
    status: str
    seat_id: int | None


class PersonCardResponse(BaseModel):
    """Full person card shown when the admin clicks a room then a person."""

    id: int
    full_name: str
    father_name: str
    phone: str
    guardian_phone: str
    cnic_number: str
    start_date: date
    next_due_date: date
    monthly_rent: int
    security_paid: int
    status: str
    building_name: str | None
    portion_name: str | None
    room_number: str | None
    seat_label: str | None
