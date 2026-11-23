"""Admin auth placeholder.

Phase 1 uses the single central login at ``POST /api/v1/auth/login``.
There is no separate admin login and no role choice on login; the
backend decides the role from the database. This module exists only
so the api/v1/admin folder is complete.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/admin/auth", tags=["admin-auth"])
