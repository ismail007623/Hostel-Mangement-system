"""Logging setup for the Taqwa Hostel backend.

Rules:
- One logger per module via ``get_logger(__name__)``.
- Never log passwords, CNIC numbers, JWT tokens, or file contents.
- Real errors go to the log only; the frontend gets a generic message.
"""

import logging
import sys

_CONFIGURED = False


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger for *name*.

    Args:
        name: Usually ``__name__`` of the calling module.

    Returns:
        A logger with a console handler. Safe to call repeatedly.
    """
    global _CONFIGURED
    if not _CONFIGURED:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
        )
        handler.setFormatter(formatter)
        root = logging.getLogger()
        root.setLevel(logging.INFO)
        root.addHandler(handler)
        _CONFIGURED = True
    return logging.getLogger(name)
