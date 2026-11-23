"""Admin payment schemas (Phase 2)."""

from pydantic import BaseModel, Field


class ApprovePaymentRequest(BaseModel):
    """Approve a pending payment. No body fields are needed."""

    pass


class RejectPaymentRequest(BaseModel):
    """Reject a pending payment. A reason is required."""

    reason: str = Field(min_length=1, max_length=500)


class RejectEditRequest(BaseModel):
    """Reject a pending profile edit request. A reason is required."""

    reason: str = Field(min_length=1, max_length=500)
