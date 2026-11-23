"""Application settings loaded from environment variables.

No real secret lives in code. ``JWT_SECRET_KEY`` must be set in ``.env``
for production; the built-in default is for local development only and
must be changed before any deployment.
"""

from pydantic_settings import BaseSettings

from app.core.logging_config import get_logger


class Settings(BaseSettings):
    """Runtime settings for the Taqwa Hostel backend."""

    database_url: str = "sqlite+aiosqlite:///./taqwa.db"
    jwt_secret_key: str = "dev-only-change-me-before-deploy"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    seed_admin_password: str = "Taqwa@123"
    upload_dir: str = "uploads"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

if settings.jwt_secret_key in (None, "", "dev-only-change-me-before-deploy"):
    logger = get_logger(__name__)
    logger.error("JWT_SECRET_KEY is not configured, using dev-only default")
