"""File helpers for rent-screenshot uploads.

Only safe filenames and image extensions are accepted.
"""

import os

from app.core.logging_config import get_logger

logger = get_logger(__name__)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def is_allowed_image(filename: str) -> bool:
    """Return True when *filename* has an allowed image extension."""
    try:
        logger.info("Checking image extension")
        _, ext = os.path.splitext(filename or "")
        allowed = ext.lower() in ALLOWED_IMAGE_EXTENSIONS
        logger.info("Image extension checked successfully.")
        return allowed
    except Exception as e:
        logger.error(f"Error checking image extension: {e}")
        raise Exception(f"Error checking image extension: {str(e)}")


def safe_filename(filename: str) -> str:
    """Return a filesystem-safe version of *filename*."""
    try:
        logger.info("Building safe filename")
        safe = os.path.basename(filename or "").replace(" ", "_")
        logger.info("Safe filename built successfully.")
        return safe
    except Exception as e:
        logger.error(f"Error building safe filename: {e}")
        raise Exception(f"Error building safe filename: {str(e)}")
