"""Shared schema helpers: validation patterns and the envelope shape.

Every endpoint returns the Xeven envelope:
``{"succeed": bool, "status": int, "message": str, "data": ...}``.
Validation errors (422) are converted to the same envelope by the
handler in ``app/main.py``.
"""

import re
from typing import Any

PHONE_PATTERN = r"^03\d{9}$"
CNIC_PATTERN = r"^\d{5}-\d{7}-\d$"


def envelope(succeed: bool, status: int, message: str, data: Any) -> dict[str, Any]:
    """Build the standard response envelope."""
    return {"succeed": succeed, "status": status, "message": message, "data": data}
