"""Model package: importing this package registers all models."""
from app.models.building import Building, Portion  # noqa: F401
from app.models.extra_charge import ResidentExtraCharge  # noqa: F401
from app.models.hostel import Hostel  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.profile_edit import ProfileEditRequest  # noqa: F401
from app.models.rent import RentCycle  # noqa: F401
from app.models.resident import Application, Resident  # noqa: F401
from app.models.room import Room, Seat  # noqa: F401
from app.models.user import User  # noqa: F401
