"""Resident payment schemas (Phase 2).

The screenshot itself arrives as a multipart file, not JSON, so the
router declares the fields with Form(). This schema documents the
same payload and is used for validation of the field values.
"""

from pydantic import BaseModel, Field

from app.models.payment import PaymentMethod


class PayRentRequest(BaseModel):
    """Pay rent for one of the resident's own rent cycles."""

    rent_cycle_id: int
    amount: int = Field(gt=0)
    method: PaymentMethod
