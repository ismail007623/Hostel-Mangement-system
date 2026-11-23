"""Extra-charge schemas (admin). Amounts are always entered by the
admin — no amount is hardcoded anywhere."""

from datetime import date

from pydantic import BaseModel, Field


class ExtraChargeInput(BaseModel):
    """One extra charge, as sent when adding a resident / approving."""

    name: str = Field(min_length=1, max_length=100)
    monthly_amount: int = Field(gt=0)
    start_date: date | None = None


class ExtraChargeCreate(BaseModel):
    """Add one extra charge to a resident."""

    name: str = Field(min_length=1, max_length=100)
    monthly_amount: int = Field(gt=0)
    start_date: date | None = None


class ExtraChargeUpdate(BaseModel):
    """Update name / amount / dates of an extra charge."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    monthly_amount: int | None = Field(default=None, gt=0)
    start_date: date | None = None
    end_date: date | None = None


class ExtraChargeResponse(BaseModel):
    """One extra charge row."""

    id: int
    resident_id: int
    name: str
    monthly_amount: int
    is_active: bool
    start_date: date | None
    end_date: date | None
