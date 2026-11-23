"""Resident auth placeholder.

Phase 1 uses the single central login at ``POST /api/v1/auth/login``.
There is no separate resident login. This module exists only so the
api/v1/resident folder is complete.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/resident/auth", tags=["resident-auth"])
