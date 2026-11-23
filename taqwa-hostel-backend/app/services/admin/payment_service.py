"""Admin + resident payment logic (Phase 2).

- A resident submits a rent payment with a screenshot (pending only).
  Submitting does NOT change the rent cycle.
- The admin approves or rejects it. Approving updates the cycle's
  paid amount / remaining; a fully-paid cycle creates the next cycle
  from the previous due date.
- Due / paid lists are built from the resident's current cycle.
- WhatsApp reminders are a plain wa.me link only. No WhatsApp API
  call is ever made.
"""

import os
import re
import urllib.parse
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.building import Building, Portion
from app.models.hostel import Hostel
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.rent import RentCycle, RentCycleStatus
from app.models.resident import Resident
from app.models.room import Room, Seat
from app.models.user import User
from app.services.resident import rent_service

logger = get_logger(__name__)

ALLOWED_SCREENSHOT_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_SCREENSHOT_TYPES = {"image/jpeg", "image/png"}
MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024


async def _hostel_settings(db: AsyncSession, hostel_id: int) -> tuple[int, int]:
    """Return (rent duration, grace days) for a hostel."""
    try:
        logger.info("Fetching hostel settings from DB")
        duration, grace = await rent_service.get_hostel_settings(db, hostel_id)
        logger.info("Hostel settings fetched successfully.")
        return duration, grace
    except Exception as e:
        logger.error(f"Database error while fetching hostel settings: {e}")
        raise Exception(f"Database error while fetching hostel settings: {e}")


async def _room_info(db: AsyncSession, resident: Resident) -> dict:
    """Return building / portion / room / seat names for a resident."""
    try:
        logger.info("Fetching room info from DB")
        seat = None
        if resident.seat_id:
            result = await db.execute(select(Seat).where(Seat.id == resident.seat_id))
            seat = result.scalars().first()
        room = None
        if seat:
            result = await db.execute(select(Room).where(Room.id == seat.room_id))
            room = result.scalars().first()
        building = None
        if room:
            result = await db.execute(select(Building).where(Building.id == room.building_id))
            building = result.scalars().first()
        portion_name = None
        if room and room.portion_id:
            result = await db.execute(select(Portion).where(Portion.id == room.portion_id))
            portion = result.scalars().first()
            portion_name = portion.name if portion else None
        logger.info("Room info fetched successfully.")
        return {
            "building_name": building.name if building else None,
            "portion_name": portion_name,
            "room_number": room.room_number if room else None,
            "seat_label": seat.seat_label if seat else None,
        }
    except Exception as e:
        logger.error(f"Database error while fetching room info: {e}")
        raise Exception(f"Database error while fetching room info: {e}")


def whatsapp_url(phone: str, message: str) -> str:
    """Build a wa.me link for a Pakistani mobile number.

    Args:
        phone: Mobile in local form, e.g. 03004493800.
        message: Plain-text message (URL-encoded).

    Returns:
        A ``https://wa.me/<international-number>?text=...`` link.
    """
    try:
        logger.info("Building WhatsApp URL")
        digits = re.sub(r"\D", "", phone or "")
        if digits.startswith("0"):
            digits = "92" + digits[1:]
        url = f"https://wa.me/{digits}?text={urllib.parse.quote(message)}"
        logger.info("WhatsApp URL built successfully.")
        return url
    except Exception as e:
        logger.error(f"Error building WhatsApp URL: {e}")
        raise Exception(f"Error building WhatsApp URL: {str(e)}")


def validate_screenshot(filename: str | None, content_type: str | None, size: int) -> None:
    """Validate an uploaded rent screenshot.

    Args:
        filename: Uploaded file name.
        content_type: Uploaded content type.
        size: File size in bytes.

    Raises:
        ValueError: When the file is not a png/jpg/jpeg image or is too big.
    """
    try:
        logger.info("Validating screenshot")
        if not filename:
            raise ValueError("Screenshot is required")
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_SCREENSHOT_EXTENSIONS:
            raise ValueError("Screenshot must be a png, jpg or jpeg image")
        if content_type and content_type not in ALLOWED_SCREENSHOT_TYPES:
            raise ValueError("Screenshot must be a png, jpg or jpeg image")
        if size > MAX_SCREENSHOT_BYTES:
            raise ValueError("Screenshot must be smaller than 5MB")
        logger.info("Screenshot validated successfully.")
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error validating screenshot: {e}")
        raise Exception(f"Error validating screenshot: {str(e)}")


def _safe_filename(filename: str) -> str:
    """Return a filesystem-safe file name (basename, safe chars only)."""
    try:
        logger.info("Building safe filename")
        name = os.path.basename(filename or "screenshot.png")
        name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
        logger.info("Safe filename built successfully.")
        return name or "screenshot.png"
    except Exception as e:
        logger.error(f"Error building safe filename: {e}")
        raise Exception(f"Error building safe filename: {str(e)}")


async def _payment_to_dict(db: AsyncSession, payment: Payment) -> dict:
    """Serialize a payment with resident and cycle details."""
    try:
        logger.info("Fetching payment details from DB")
        result = await db.execute(select(Resident).where(Resident.id == payment.resident_id))
        resident = result.scalars().first()
        user = None
        if resident:
            result = await db.execute(select(User).where(User.id == resident.user_id))
            user = result.scalars().first()
        cycle = None
        if payment.rent_cycle_id:
            result = await db.execute(select(RentCycle).where(RentCycle.id == payment.rent_cycle_id))
            cycle = result.scalars().first()
        data = {
            "id": payment.id,
            "resident_id": payment.resident_id,
            "full_name": user.full_name if user else "",
            "phone": user.phone if user else "",
            "rent_cycle_id": payment.rent_cycle_id,
            "amount": payment.amount,
            "method": payment.method,
            "screenshot_url": payment.screenshot_url,
            "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
            "status": payment.status,
            "reject_reason": payment.reject_reason,
            "created_at": payment.created_at.isoformat() if payment.created_at else None,
        }
        if resident is not None:
            data.update(await _room_info(db, resident))
        if cycle is not None:
            data["cycle"] = await rent_service.serialize_cycle(db, cycle)
        logger.info("Payment details fetched successfully.")
        return data
    except Exception as e:
        logger.error(f"Database error while fetching payment details: {e}")
        raise Exception(f"Database error while fetching payment details: {e}")


async def submit_payment(
    db: AsyncSession,
    user: User,
    rent_cycle_id: int,
    amount: int,
    method: str,
    filename: str,
    content_type: str | None,
    file_bytes: bytes,
) -> dict:
    """Submit a rent payment for the logged-in resident only.

    The cycle must belong to this resident, must not be fully paid,
    and the amount must not exceed the remaining rent. The cycle is
    NOT updated here; it changes only when the admin approves.

    Args:
        db: Async database session.
        user: The logged-in resident user (from JWT).
        rent_cycle_id: Cycle being paid.
        amount: Amount paid (must be > 0 and <= remaining).
        method: Payment method (JazzCash / Easypaisa / Bank / Cash).
        filename: Screenshot file name.
        content_type: Screenshot content type.
        file_bytes: Screenshot file bytes.

    Returns:
        The created pending payment.

    Raises:
        LookupError: When the resident or cycle is not found.
        PermissionError: When the cycle belongs to another resident.
        ValueError: When the amount or screenshot is invalid.
    """
    try:
        logger.info("Fetching resident from DB for payment")
        result = await db.execute(select(Resident).where(Resident.user_id == user.id))
        resident = result.scalars().first()
        if resident is None:
            raise LookupError("Resident profile not found")
        result = await db.execute(select(RentCycle).where(RentCycle.id == rent_cycle_id))
        cycle = result.scalars().first()
        if cycle is None:
            raise LookupError("Rent cycle not found")
        if cycle.resident_id != resident.id:
            raise PermissionError("This rent cycle belongs to another resident")
        if cycle.hostel_id != user.hostel_id:
            raise PermissionError("This rent cycle belongs to another hostel")
        if amount <= 0:
            raise ValueError("Amount must be more than zero")
        remaining = rent_service.remaining_amount(cycle)
        if remaining <= 0:
            raise ValueError("This rent cycle is already fully paid")
        if amount > remaining:
            raise ValueError("Amount is more than the remaining rent")
        if method not in [m.value for m in PaymentMethod]:
            raise ValueError("Invalid payment method")
        validate_screenshot(filename, content_type, len(file_bytes))

        payment = Payment(
            resident_id=resident.id,
            rent_cycle_id=cycle.id,
            hostel_id=user.hostel_id,
            amount=amount,
            method=method,
            payment_date=date.today(),
            status=PaymentStatus.PENDING.value,
        )
        db.add(payment)
        await db.flush()
        upload_dir = Path(settings.upload_dir) / "payments"
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = _safe_filename(filename) or "screenshot.png"
        stored_name = f"{payment.id}_{safe_name}"
        stored_path = upload_dir / stored_name
        stored_path.write_bytes(file_bytes)
        payment.screenshot_path = str(stored_path)
        payment.screenshot_url = str(stored_path)
        await db.commit()
        await db.refresh(payment)
        logger.info("Rent payment submitted successfully.")
        return await _payment_to_dict(db, payment)
    except (LookupError, PermissionError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while submitting payment: {e}")
        raise Exception(f"Database error while submitting payment: {e}")


async def list_payments_for_resident(db: AsyncSession, resident_id: int) -> list[dict]:
    """List one resident's own payments, newest first."""
    try:
        logger.info("Fetching payments from DB")
        result = await db.execute(
            select(Payment)
            .where(Payment.resident_id == resident_id)
            .order_by(Payment.created_at.desc(), Payment.id.desc())
        )
        rows = result.scalars().all()
        out = []
        for p in rows:
            out.append(await _payment_to_dict(db, p))
        logger.info("Payments fetched successfully.")
        return out
    except Exception as e:
        logger.error(f"Database error while fetching payments: {e}")
        raise Exception(f"Database error while fetching payments: {e}")


async def list_payments(db: AsyncSession, hostel_id: int, status: str | None = None) -> list[dict]:
    """List payments in the admin's hostel, newest first."""
    try:
        logger.info("Fetching payments from DB")
        stmt = select(Payment).where(Payment.hostel_id == hostel_id)
        if status:
            if status not in [s.value for s in PaymentStatus]:
                raise ValueError("Invalid payment status")
            stmt = stmt.where(Payment.status == status)
        result = await db.execute(stmt.order_by(Payment.created_at.desc(), Payment.id.desc()))
        rows = result.scalars().all()
        out = []
        for p in rows:
            out.append(await _payment_to_dict(db, p))
        logger.info("Payments fetched successfully.")
        return out
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching payments: {e}")
        raise Exception(f"Database error while fetching payments: {e}")


async def get_payment(db: AsyncSession, hostel_id: int, payment_id: int) -> dict:
    """Return one payment in the admin's hostel."""
    try:
        logger.info("Fetching payment from DB")
        result = await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.hostel_id == hostel_id)
        )
        payment = result.scalars().first()
        if payment is None:
            raise LookupError("Payment not found")
        logger.info("Payment fetched successfully.")
        return await _payment_to_dict(db, payment)
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching payment: {e}")
        raise Exception(f"Database error while fetching payment: {e}")


async def approve_payment(db: AsyncSession, hostel_id: int, payment_id: int, admin_id: int) -> dict:
    """Approve a pending payment and update its rent cycle.

    Args:
        db: Async database session.
        hostel_id: Admin's hostel (from token).
        payment_id: Payment to approve.
        admin_id: Admin user id (recorded as reviewer).

    Returns:
        The approved payment, including the updated cycle and,
        when the cycle is fully paid, the newly created next cycle.
    """
    try:
        logger.info("Fetching payment from DB")
        result = await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.hostel_id == hostel_id)
        )
        payment = result.scalars().first()
        if payment is None:
            raise LookupError("Payment not found")
        if payment.status != PaymentStatus.PENDING.value:
            raise ValueError("Payment is not pending")
        result = await db.execute(select(RentCycle).where(RentCycle.id == payment.rent_cycle_id))
        cycle = result.scalars().first()
        if cycle is None:
            raise LookupError("Rent cycle not found")
        remaining = rent_service.remaining_amount(cycle)
        if payment.amount > remaining:
            raise ValueError("Payment amount is more than the remaining rent")
        cycle.paid_amount += payment.amount
        payment.status = PaymentStatus.APPROVED.value
        payment.reviewed_by = admin_id
        next_cycle = None
        if cycle.paid_amount >= cycle.total_amount:
            cycle.status = RentCycleStatus.PAID.value
            await db.commit()
            await db.refresh(cycle)
            next_cycle = await rent_service.create_next_cycle(db, cycle)
        else:
            cycle.status = RentCycleStatus.PARTIAL.value
            await db.commit()
            await db.refresh(cycle)
        await db.refresh(payment)
        logger.info("Payment approved successfully.")
        data = await _payment_to_dict(db, payment)
        if next_cycle is not None:
            data["next_cycle"] = await rent_service.serialize_cycle(db, next_cycle)
        return data
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while approving payment: {e}")
        raise Exception(f"Database error while approving payment: {e}")


async def reject_payment(db: AsyncSession, hostel_id: int, payment_id: int, admin_id: int, reason: str) -> dict:
    """Reject a pending payment. The rent cycle is unchanged."""
    try:
        logger.info("Fetching payment from DB")
        result = await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.hostel_id == hostel_id)
        )
        payment = result.scalars().first()
        if payment is None:
            raise LookupError("Payment not found")
        if payment.status != PaymentStatus.PENDING.value:
            raise ValueError("Payment is not pending")
        payment.status = PaymentStatus.REJECTED.value
        payment.reject_reason = reason
        payment.reviewed_by = admin_id
        await db.commit()
        await db.refresh(payment)
        logger.info("Payment rejected successfully.")
        return await _payment_to_dict(db, payment)
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while rejecting payment: {e}")
        raise Exception(f"Database error while rejecting payment: {e}")


async def _current_cycle_row(db: AsyncSession, hostel_id: int, resident: Resident) -> dict | None:
    """Build one due-list row for a resident's current cycle."""
    try:
        logger.info("Fetching current cycle from DB for due list")
        cycle = await rent_service.get_current_cycle(db, resident.id)
        if cycle is None:
            return None
        duration, grace = await _hostel_settings(db, hostel_id)
        status = rent_service.effective_status(cycle, grace)
        result = await db.execute(select(User).where(User.id == resident.user_id))
        user = result.scalars().first()
        remaining = rent_service.remaining_amount(cycle)
        today = date.today()
        due_soon = (
            remaining > 0
            and status != RentCycleStatus.OVERDUE.value
            and (cycle.due_date - today).days <= rent_service.DUE_SOON_DAYS
        )
        message = (
            f"Assalam-o-Alaikum {user.full_name if user else ''}, "
            f"aapka hostel rent Rs {remaining} due hai, "
            f"due date {cycle.due_date.isoformat()} hai. "
            "Please jald pay kar dein."
        )
        row = {
            "resident_id": resident.id,
            "full_name": user.full_name if user else "",
            "phone": user.phone if user else "",
            "guardian_phone": resident.guardian_phone,
            "monthly_rent": resident.monthly_rent,
            "extras_total": 0,
            "monthly_total": resident.monthly_rent,
            "extras": [],
            "cycle": await rent_service.serialize_cycle(db, cycle),
            "remaining": remaining,
            "status": "due_soon" if due_soon else status,
            "whatsapp_url": whatsapp_url(user.phone if user else "", message),
        }
        from app.services.admin import extra_charge_service

        _extras = await extra_charge_service.list_extras(db, hostel_id, resident.id)
        row["extras"] = _extras
        row["extras_total"] = sum(e["monthly_amount"] for e in _extras if e["is_active"])
        row["monthly_total"] = resident.monthly_rent + row["extras_total"]
        row.update(await _room_info(db, resident))
        logger.info("Due list row built successfully.")
        return row
    except Exception as e:
        logger.error(f"Database error while building due list row: {e}")
        raise Exception(f"Database error while building due list row: {e}")


async def get_due_list(db: AsyncSession, hostel_id: int, status_filter: str = "all") -> list[dict]:
    """Return residents with an open rent cycle.

    Args:
        db: Async database session.
        hostel_id: Admin's hostel.
        status_filter: "due", "overdue", "due_soon" or "all".

    Returns:
        One row per resident with an unpaid cycle, filtered by status.
    """
    try:
        logger.info("Fetching due list from DB")
        if status_filter not in ("due", "overdue", "due_soon", "all"):
            raise ValueError("Invalid status filter")
        result = await db.execute(
            select(Resident).where(Resident.hostel_id == hostel_id, Resident.status == "active")
        )
        residents = result.scalars().all()
        rows: list[dict] = []
        for resident in residents:
            row = await _current_cycle_row(db, hostel_id, resident)
            if row is None:
                continue
            if row["remaining"] <= 0:
                continue
            if status_filter == "overdue" and row["status"] != RentCycleStatus.OVERDUE.value:
                continue
            if status_filter == "due_soon" and row["status"] != "due_soon":
                continue
            if status_filter == "due" and row["status"] == RentCycleStatus.OVERDUE.value:
                continue
            rows.append(row)
        rows.sort(key=lambda r: r["cycle"]["due_date"])
        logger.info("Due list fetched successfully.")
        return rows
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching due list: {e}")
        raise Exception(f"Database error while fetching due list: {e}")


async def get_paid_list(db: AsyncSession, hostel_id: int) -> list[dict]:
    """Return fully-paid cycles in the admin's hostel, newest first."""
    try:
        logger.info("Fetching paid list from DB")
        result = await db.execute(
            select(RentCycle)
            .where(RentCycle.hostel_id == hostel_id)
            .order_by(RentCycle.due_date.desc(), RentCycle.id.desc())
        )
        cycles = result.scalars().all()
        rows: list[dict] = []
        for cycle in cycles:
            if cycle.paid_amount < cycle.total_amount:
                continue
            result = await db.execute(select(Resident).where(Resident.id == cycle.resident_id))
            resident = result.scalars().first()
            if resident is None:
                continue
            result = await db.execute(select(User).where(User.id == resident.user_id))
            user = result.scalars().first()
            row = {
                "resident_id": resident.id,
                "full_name": user.full_name if user else "",
                "phone": user.phone if user else "",
                "monthly_rent": resident.monthly_rent,
                "extras_total": max(0, cycle.total_amount - resident.monthly_rent),
                "monthly_total": cycle.total_amount,
                "cycle": await rent_service.serialize_cycle(db, cycle),
            }
            row.update(await _room_info(db, resident))
            rows.append(row)
        logger.info("Paid list fetched successfully.")
        return rows
    except Exception as e:
        logger.error(f"Database error while fetching paid list: {e}")
        raise Exception(f"Database error while fetching paid list: {e}")


async def get_rent_counts(db: AsyncSession, hostel_id: int) -> dict:
    """Return paid-this-month, due and overdue counts for the dashboard."""
    try:
        logger.info("Fetching rent counts from DB")
        today = date.today()
        duration, grace = await _hostel_settings(db, hostel_id)
        result = await db.execute(select(RentCycle).where(RentCycle.hostel_id == hostel_id))
        cycles = result.scalars().all()
        due_count = 0
        overdue_count = 0
        for cycle in cycles:
            status = rent_service.effective_status(cycle, grace, today)
            if cycle.paid_amount >= cycle.total_amount:
                continue
            if status == RentCycleStatus.OVERDUE.value:
                overdue_count += 1
            else:
                due_count += 1
        month_start = today.replace(day=1)
        result = await db.execute(
            select(Payment).where(
                Payment.hostel_id == hostel_id,
                Payment.status == PaymentStatus.APPROVED.value,
            )
        )
        approved = result.scalars().all()
        paid_this_month = 0
        paid_amount_this_month = 0
        for payment in approved:
            paid_on = payment.payment_date or (payment.created_at.date() if payment.created_at else None)
            if paid_on is not None and paid_on >= month_start:
                paid_this_month += 1
                paid_amount_this_month += payment.amount
        logger.info("Rent counts fetched successfully.")
        return {
            "paid_this_month": paid_this_month,
            "paid_amount_this_month": paid_amount_this_month,
            "due_count": due_count,
            "overdue_count": overdue_count,
        }
    except Exception as e:
        logger.error(f"Database error while fetching rent counts: {e}")
        raise Exception(f"Database error while fetching rent counts: {e}")
