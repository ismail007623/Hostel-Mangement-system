"""Seed the first admin (Qari Abdul Majeed) and the Taqwa hostel.

Run once: ``python -m app.seed_admin``

- Creates the hostel + settings (rent 30 days, grace 3, security 10000)
  if they do not exist.
- Creates admin user Qari Abdul Majeed, phone 03004493800, role admin.
- Password comes from env SEED_ADMIN_PASSWORD (default Taqwa@123,
  local dev only). Qari must change it after the first login.
- Idempotent: running it again does NOT duplicate the hostel or admin.

This is the ONLY way an admin account is created. There is no
public admin signup; role never comes from a client payload.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import async_session, init_db  # noqa: E402
from app.core.logging_config import get_logger  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.hostel import Hostel  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

logger = get_logger(__name__)

HOSTEL_NAME = "Taqwa Boys Hostel"
HOSTEL_SLUG = "taqwa-boys-hostel"
HOSTEL_ADDRESS = "5 UMT Rd, Block C2 Phase 1 Johar Town, Lahore 54770"
ADMIN_NAME = "Qari Abdul Majeed"
ADMIN_PHONE = "03004493800"


async def seed() -> dict:
    """Create hostel + admin if missing. Returns what was created."""
    try:
        logger.info("Seeding hostel and admin from DB")
        await init_db()
        async with async_session() as db:
            result = await db.execute(select(Hostel).where(Hostel.slug == HOSTEL_SLUG))
            hostel = result.scalars().first()
            if hostel is None:
                hostel = Hostel(
                    name=HOSTEL_NAME,
                    slug=HOSTEL_SLUG,
                    address=HOSTEL_ADDRESS,
                    contact_phone=ADMIN_PHONE,
                    rent_duration_days=30,
                    grace_days=3,
                    security_standard=10000,
                )
                db.add(hostel)
                await db.commit()
                await db.refresh(hostel)
                logger.info("Hostel created by seed successfully.")
            result = await db.execute(select(User).where(User.phone == ADMIN_PHONE))
            admin = result.scalars().first()
            if admin is None:
                admin = User(
                    hostel_id=hostel.id,
                    role=UserRole.ADMIN.value,
                    full_name=ADMIN_NAME,
                    phone=ADMIN_PHONE,
                    password_hash=hash_password(settings.seed_admin_password),
                    is_active=True,
                )
                db.add(admin)
                await db.commit()
                logger.info("Admin created by seed successfully.")
            else:
                logger.info("Admin already exists, seed skipped creating it")
            logger.info("Seed completed successfully.")
            return {"hostel_id": hostel.id, "admin_phone": ADMIN_PHONE, "admin_name": ADMIN_NAME}
    except Exception as e:
        logger.error(f"Database error while seeding admin: {e}")
        raise Exception(f"Database error while seeding admin: {e}")


if __name__ == "__main__":
    result = asyncio.run(seed())
    print(f"Seed done. Admin login phone: {result['admin_phone']} (change the temporary password after first login).")
    print("WARNING: default seed password is for local dev only. Set SEED_ADMIN_PASSWORD in .env for a real password.")
