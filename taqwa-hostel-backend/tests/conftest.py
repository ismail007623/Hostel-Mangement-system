"""Shared test setup for Phase 1, Phase 2 and Phase 3 tests.

One in-memory SQLite database (aiosqlite), one httpx AsyncClient,
one dependency override for the whole session. All test files import
their helpers from here so they can never end up with two different
engines (which used to make logins fail with 401 when both files
ran together).
"""

import asyncio
import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-for-phase1-only"

import httpx
from httpx import ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.hostel import Hostel
from app.models.user import User, UserRole
from main import app

engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def _create_tables() -> None:
    """Create all tables in the in-memory test database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


asyncio.run(_create_tables())


async def _override_db():
    async with TestingSession() as session:
        yield session


app.dependency_overrides[get_db] = _override_db
client = httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

ADMIN_PHONE = "03004493800"
ADMIN_PASS = "Taqwa@123"


async def _seed() -> int:
    """Create the Taqwa hostel + seed admin (idempotent)."""
    async with TestingSession() as db:
        result = await db.execute(select(Hostel).where(Hostel.slug == "taqwa-boys-hostel"))
        hostel = result.scalars().first()
        if hostel is None:
            hostel = Hostel(
                name="Taqwa Boys Hostel",
                slug="taqwa-boys-hostel",
                address="5 UMT Rd, Johar Town, Lahore",
                contact_phone=ADMIN_PHONE,
            )
            db.add(hostel)
            await db.commit()
            await db.refresh(hostel)
        result = await db.execute(select(User).where(User.phone == ADMIN_PHONE))
        admin = result.scalars().first()
        if admin is None:
            admin = User(
                hostel_id=hostel.id,
                role=UserRole.ADMIN.value,
                full_name="Qari Abdul Majeed",
                phone=ADMIN_PHONE,
                password_hash=hash_password(ADMIN_PASS),
                is_active=True,
            )
            db.add(admin)
            await db.commit()
        return hostel.id


async def _login(phone: str, password: str) -> dict:
    """Log in and return the token payload (asserts success)."""
    r = await client.post("/api/v1/auth/login", json={"phone": phone, "password": password})
    assert r.status_code == 200, r.text
    assert r.json()["succeed"] is True
    return r.json()["data"]


def pytest_sessionfinish(session, exitstatus):
    """Close the shared test client and dispose the test engine.

    aiosqlite runs a non-daemon worker thread per connection; if the
    engine is never disposed that thread blocks interpreter shutdown
    and pytest hangs after the last test instead of exiting.
    """
    async def _cleanup():
        await client.aclose()
        await engine.dispose()
    asyncio.run(_cleanup())


def _auth(token: str) -> dict:
    """Build an Authorization header from an access token."""
    return {"Authorization": f"Bearer {token}"}
