"""Resident schemas: own profile, own room, edit-profile request."""

from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import CNIC_PATTERN, PHONE_PATTERN


class MyRoomResponse(BaseModel):
    """The resident's own room, room only (no other residents)."""

    full_name: str
    building_name: str | None
    portion_name: str | None
    room_number: str | None
    seat_label: str | None
    monthly_rent: int
    start_date: date
    next_due_date: date
    security_paid: int


class EditProfileRequest(BaseModel):
    """Edit-profile request (Phase 2).

    All fields are optional, but at least one must be sent.
    Guardian-only changes are applied immediately; full_name / phone /
    cnic_number changes create a pending request for admin approval.
    """

    full_name: str | None = Field(default=None, min_length=3, max_length=200)
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    guardian_name: str | None = Field(default=None, min_length=3, max_length=200)
    guardian_phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    cnic_number: str | None = Field(default=None, pattern=CNIC_PATTERN)

    @model_validator(mode="after")
    def _at_least_one_field(self):
        """Require at least one field to change."""
        if not any(
            value is not None
            for value in (
                self.full_name,
                self.phone,
                self.guardian_name,
                self.guardian_phone,
                self.cnic_number,
            )
        ):
            raise ValueError("At least one field is required")
        return self
