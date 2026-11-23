"""Date helpers for the rent cycle.

Rent rule (locked): due date = start date + rent duration (30 days).
The next due date advances from the previous due date, not from the
payment date, so a late payer does not gain extra days.
"""

from datetime import date, timedelta

from app.core.logging_config import get_logger

logger = get_logger(__name__)


def next_due_date(start_date: date, duration_days: int = 30) -> date:
    """Return the rent due date for a cycle starting on *start_date*.

    Args:
        start_date: First day of the rent cycle.
        duration_days: Rent duration in days (default 30).

    Returns:
        The due date as a ``date``.
    """
    try:
        logger.info("Calculating next due date")
        due = start_date + timedelta(days=duration_days)
        logger.info("Next due date calculated successfully.")
        return due
    except Exception as e:
        logger.error(f"Error calculating next due date: {e}")
        raise Exception(f"Error calculating next due date: {str(e)}")


def add_days(start_date: date, days: int) -> date:
    """Return *start_date* plus *days* days."""
    try:
        logger.info("Adding days to date")
        result = start_date + timedelta(days=days)
        logger.info("Days added successfully.")
        return result
    except Exception as e:
        logger.error(f"Error adding days: {e}")
        raise Exception(f"Error adding days: {str(e)}")
