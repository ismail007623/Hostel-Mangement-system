"""Database setup: async SQLAlchemy.

PostgreSQL via ``postgresql+asyncpg://`` (DATABASE_URL), SQLite for
local dev / tests via ``sqlite+aiosqlite://``. Every database call
is awaited; there is no sync session anywhere in the app.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
async_session = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)
# Backwards-compatible name used by the seed script and tests.
SessionLocal = async_session
Base = declarative_base()


async def get_db():
    """Yield one async database session, then close it.

    Yields:
        An ``AsyncSession`` for the request.
    """
    async with async_session() as session:
        try:
            logger.info("Database session opened successfully.")
            yield session
        except Exception as e:
            logger.error(f"Database error while using session: {e}")
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables. Imports models so Base knows about them."""
    # Imported here to avoid circular imports at module load time.
    from app.models import (  # noqa: F401
        building,
        extra_charge,
        hostel,
        payment,
        profile_edit,
        rent,
        resident,
        room,
        user,
    )

    try:
        logger.info("Creating database tables.")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully.")
    except Exception as e:
        logger.error(f"Database error while creating tables: {e}")
        raise Exception(f"Database error while creating tables: {e}")
