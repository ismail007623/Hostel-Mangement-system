"""API v1 router: every endpoint is registered here.

``main.py`` only does ``app.include_router(api_router, prefix="/api")``
and stays clean. Each sub-router carries its own ``/v1/...`` prefix,
so the final paths are exactly the old ones, e.g.
``/api`` + ``/v1/auth/login`` = ``POST /api/v1/auth/login``.
"""

from fastapi import APIRouter

from app.api.v1 import auth as central_auth
from app.api.v1.admin import applications as admin_applications
from app.api.v1.admin import auth as admin_auth
from app.api.v1.admin import buildings as admin_buildings
from app.api.v1.admin import dashboard as admin_dashboard
from app.api.v1.admin import payments as admin_payments
from app.api.v1.admin import profile_edit_requests as admin_profile_edits
from app.api.v1.admin import rent as admin_rent
from app.api.v1.admin import residents as admin_residents
from app.api.v1.admin import settings as admin_settings
from app.api.v1.public import apply as public_apply
from app.api.v1.public import hostel as public_hostel
from app.api.v1.public import seats as public_seats
from app.api.v1.resident import auth as resident_auth
from app.api.v1.resident import payments as resident_payments
from app.api.v1.resident import profile as resident_profile
from app.api.v1.resident import rent as resident_rent

api_router = APIRouter()

api_router.include_router(central_auth.router)
api_router.include_router(admin_auth.router)
api_router.include_router(resident_auth.router)
api_router.include_router(admin_dashboard.router)
api_router.include_router(admin_buildings.router)
api_router.include_router(admin_residents.router)
api_router.include_router(admin_applications.router)
api_router.include_router(admin_settings.router)
api_router.include_router(admin_payments.router)
api_router.include_router(admin_rent.router)
api_router.include_router(admin_profile_edits.router)
api_router.include_router(resident_profile.router)
api_router.include_router(resident_rent.router)
api_router.include_router(resident_payments.router)
api_router.include_router(public_hostel.router)
api_router.include_router(public_seats.router)
api_router.include_router(public_apply.router)
