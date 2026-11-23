"""Admin resident logic: manual add, list, person card, applications.

The person card's next due date is start date + rent duration
(30 days by default, from the hostel settings row).
"""

import secrets
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.core.security import hash_password
from app.models.building import Building, Portion
from app.models.hostel import Hostel
from app.models.resident import Application, ApplicationStatus, Resident
from app.models.room import Room, Seat, SeatStatus
from app.models.user import User, UserRole
from app.schemas.admin.resident import ResidentCreate
from app.schemas.public.apply import InviteCreate, OnboardingRequest
from app.services.resident import rent_service
from app.utils.date_utils import next_due_date

logger = get_logger(__name__)


async def _due_for(db: AsyncSession, hostel_id: int, start: date) -> date:
    """Return next due date using the hostel's rent duration."""
    try:
        logger.info("Fetching hostel from DB for due date")
        result = await db.execute(select(Hostel).where(Hostel.id == hostel_id))
        hostel = result.scalars().first()
        duration = hostel.rent_duration_days if hostel else 30
        logger.info("Due date calculated successfully.")
        return next_due_date(start, duration)
    except Exception as e:
        logger.error(f"Database error while calculating due date: {e}")
        raise Exception(f"Database error while calculating due date: {e}")


async def _person_card(db: AsyncSession, hostel_id: int, resident: Resident) -> dict:
    """Build the full person card for one resident."""
    try:
        logger.info("Fetching person card data from DB")
        result = await db.execute(select(User).where(User.id == resident.user_id))
        user = result.scalars().first()
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
        logger.info("Person card fetched successfully.")
        from app.services.admin import extra_charge_service

        extras = await extra_charge_service.list_extras(db, hostel_id, resident.id)
        extras_total = sum(e["monthly_amount"] for e in extras if e["is_active"])
        return {
            "id": resident.id,
            "full_name": user.full_name if user else "",
            "father_name": resident.father_name,
            "phone": user.phone if user else "",
            "guardian_phone": resident.guardian_phone,
            "cnic_number": resident.cnic_number,
            "start_date": resident.start_date.isoformat(),
            "next_due_date": (await _due_for(db, hostel_id, resident.start_date)).isoformat(),
            "monthly_rent": resident.monthly_rent,
            "extras": extras,
            "extras_total": extras_total,
            "monthly_total": resident.monthly_rent + extras_total,
            "security_paid": resident.security_paid,
            "status": resident.status,
            "building_name": building.name if building else None,
            "portion_name": portion_name,
            "room_number": room.room_number if room else None,
            "seat_label": seat.seat_label if seat else None,
        }
    except Exception as e:
        logger.error(f"Database error while fetching person card: {e}")
        raise Exception(f"Database error while fetching person card: {e}")


async def _summary(db: AsyncSession, hostel_id: int, resident: Resident) -> dict:
    """Build the short resident row for list views."""
    try:
        logger.info("Fetching resident summary from DB")
        result = await db.execute(select(User).where(User.id == resident.user_id))
        user = result.scalars().first()
        logger.info("Resident summary fetched successfully.")
        from app.services.admin import extra_charge_service

        extras_total = await extra_charge_service.active_extras_total(db, resident.id)
        return {
            "id": resident.id,
            "full_name": user.full_name if user else "",
            "phone": user.phone if user else "",
            "cnic_number": resident.cnic_number,
            "monthly_rent": resident.monthly_rent,
            "extras_total": extras_total,
            "monthly_total": resident.monthly_rent + extras_total,
            "security_paid": resident.security_paid,
            "start_date": resident.start_date.isoformat(),
            "next_due_date": (await _due_for(db, hostel_id, resident.start_date)).isoformat(),
            "status": resident.status,
            "seat_id": resident.seat_id,
        }
    except Exception as e:
        logger.error(f"Database error while fetching resident summary: {e}")
        raise Exception(f"Database error while fetching resident summary: {e}")


async def _get_vacant_seat_in_hostel(db: AsyncSession, hostel_id: int, seat_id: int) -> tuple[Seat, Room, Building]:
    """Return (seat, room, building) when the seat is vacant in this hostel.

    Raises:
        ValueError: When the seat is missing, taken, or in another hostel.
    """
    try:
        logger.info("Fetching seat from DB")
        result = await db.execute(select(Seat).where(Seat.id == seat_id))
        seat = result.scalars().first()
        if seat is None or seat.status != SeatStatus.VACANT.value:
            raise ValueError("Seat is not vacant")
        result = await db.execute(select(Room).where(Room.id == seat.room_id))
        room = result.scalars().first()
        result = await db.execute(select(Building).where(Building.id == room.building_id)) if room else None
        building = result.scalars().first() if result is not None else None
        if building is None or building.hostel_id != hostel_id:
            raise ValueError("Seat is not in this hostel")
        logger.info("Seat fetched successfully.")
        return seat, room, building
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching seat: {e}")
        raise Exception(f"Database error while fetching seat: {e}")


async def create_resident_manual(db: AsyncSession, hostel_id: int, payload: ResidentCreate) -> dict:
    """Create an active resident directly (admin walk-in add).

    Validates that the phone and CNIC are not already used and that
    the chosen seat is vacant, then marks it occupied.
    """
    try:
        logger.info("Fetching user from DB for manual resident")
        result = await db.execute(select(User).where(User.phone == payload.phone))
        if result.scalars().first():
            raise ValueError("Phone already registered")
        result = await db.execute(select(Resident).where(Resident.cnic_number == payload.cnic_number))
        if result.scalars().first():
            raise ValueError("CNIC already registered")
        result = await db.execute(select(Application).where(Application.cnic_number == payload.cnic_number))
        if result.scalars().first():
            raise ValueError("CNIC already registered")
        seat, room, building = await _get_vacant_seat_in_hostel(db, hostel_id, payload.seat_id)
        user = User(
            hostel_id=hostel_id,
            role=UserRole.RESIDENT.value,
            full_name=payload.full_name,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
            is_active=True,
        )
        db.add(user)
        await db.flush()
        resident = Resident(
            user_id=user.id,
            hostel_id=hostel_id,
            seat_id=seat.id,
            father_name=payload.father_name,
            guardian_phone=payload.guardian_phone,
            cnic_number=payload.cnic_number,
            start_date=payload.start_date,
            monthly_rent=payload.monthly_rent,
            security_paid=payload.security_paid,
            status="active",
        )
        db.add(resident)
        seat.status = SeatStatus.OCCUPIED.value
        await db.commit()
        await db.refresh(resident)
        from app.services.admin import extra_charge_service

        # Extras BEFORE the first cycle, so its total includes them.
        await extra_charge_service.create_extras_for_resident(db, resident.id, payload.extras)
        await db.commit()
        await rent_service.create_first_cycle(db, resident)
        logger.info("Resident created successfully.")
        return await _summary(db, hostel_id, resident)
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while creating resident: {e}")
        raise Exception(f"Database error while creating resident: {e}")


async def list_residents(
    db: AsyncSession, hostel_id: int, page: int = 1, page_size: int = 20, search: str | None = None
) -> dict:
    """List residents in the admin's hostel, paginated.

    ``search`` matches name, phone AND CNIC (case-insensitive,
    partial match). Returns items + total / page / page_size / pages.
    """
    try:
        logger.info("Fetching residents from DB")
        from sqlalchemy import func, or_

        from app.services.admin import extra_charge_service  # noqa: F401  (kept for symmetry)

        page = max(1, page)
        page_size = min(100, max(1, page_size))
        stmt = select(Resident).where(Resident.hostel_id == hostel_id)
        count_stmt = select(func.count()).select_from(Resident).where(Resident.hostel_id == hostel_id)
        if search:
            term = f"%{search.strip().lower()}%"
            # Name lives on User, phone on User, CNIC on Resident.
            user_ids = (
                await db.execute(
                    select(User.id).where(
                        or_(
                            func.lower(User.full_name).like(term),
                            func.lower(User.phone).like(term),
                        )
                    )
                )
            ).scalars().all()
            stmt = stmt.where(
                or_(
                    Resident.user_id.in_(user_ids) if user_ids else False,
                    func.lower(Resident.cnic_number).like(term),
                )
            )
            count_stmt = select(func.count()).select_from(Resident).where(
                Resident.hostel_id == hostel_id,
                or_(
                    Resident.user_id.in_(user_ids) if user_ids else False,
                    func.lower(Resident.cnic_number).like(term),
                ),
            )
        total = (await db.execute(count_stmt)).scalar() or 0
        result = await db.execute(
            stmt.order_by(Resident.id.asc()).offset((page - 1) * page_size).limit(page_size)
        )
        rows = result.scalars().all()
        out = []
        for r in rows:
            out.append(await _summary(db, hostel_id, r))
        pages = (total + page_size - 1) // page_size if total else 0
        logger.info("Residents fetched successfully.")
        return {"items": out, "total": total, "page": page, "page_size": page_size, "pages": pages}
    except Exception as e:
        logger.error(f"Database error while fetching residents: {e}")
        raise Exception(f"Database error while fetching residents: {e}")


async def export_residents_csv(db: AsyncSession, hostel_id: int, search: str | None = None) -> str:
    """Build the residents CSV export (same search filter as the list).

    Columns: name, father name, phone, CNIC, room, seat, base rent,
    extras, total, due date, status.
    """
    import csv
    import io

    try:
        logger.info("Building residents CSV export")
        page_data = await list_residents(db, hostel_id, page=1, page_size=10000, search=search)
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(
            ["name", "father_name", "phone", "cnic", "room", "seat", "base_rent", "extras", "total", "due_date", "status"]
        )
        for row in page_data["items"]:
            card = await get_resident(db, hostel_id, row["id"])
            extras_text = "; ".join(
                f"{e['name']} {e['monthly_amount']}" for e in card.get("extras", []) if e["is_active"]
            )
            writer.writerow(
                [
                    card["full_name"],
                    card["father_name"],
                    card["phone"],
                    card["cnic_number"],
                    card.get("room_number") or "",
                    card.get("seat_label") or "",
                    card["monthly_rent"],
                    extras_text,
                    card["monthly_total"],
                    card["next_due_date"],
                    card["status"],
                ]
            )
        logger.info("Residents CSV export built successfully.")
        return out.getvalue()
    except Exception as e:
        logger.error(f"Database error while building residents export: {e}")
        raise Exception(f"Database error while building residents export: {e}")


async def get_resident(db: AsyncSession, hostel_id: int, resident_id: int) -> dict:
    """Return the person card for one resident (admin only)."""
    try:
        logger.info("Fetching resident from DB")
        result = await db.execute(
            select(Resident).where(Resident.id == resident_id, Resident.hostel_id == hostel_id)
        )
        resident = result.scalars().first()
        if resident is None:
            raise LookupError("Resident not found")
        logger.info("Resident fetched successfully.")
        return await _person_card(db, hostel_id, resident)
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching resident: {e}")
        raise Exception(f"Database error while fetching resident: {e}")


async def create_invite(db: AsyncSession, hostel_id: int, payload: InviteCreate) -> dict:
    """Create an invite application with a one-time token link.

    The link is returned to the admin (Qari sends it on WhatsApp).
    The token itself is stored; the link is ``/apply?token=...``.
    """
    try:
        logger.info("Fetching user from DB for invite")
        result = await db.execute(select(User).where(User.phone == payload.phone))
        if result.scalars().first():
            raise ValueError("Phone already registered")
        token = secrets.token_urlsafe(24)
        application = Application(
            hostel_id=hostel_id,
            invite_token=token,
            full_name=payload.full_name or "",
            father_name="",
            phone=payload.phone,
            guardian_phone=payload.phone,
            cnic_number="",
            password_hash=hash_password("temporary"),
            start_date=date.today(),
            monthly_rent=0,
            security_paid=0,
            status=ApplicationStatus.PENDING.value,
        )
        db.add(application)
        await db.commit()
        await db.refresh(application)
        logger.info("Invite created successfully.")
        return {"application_id": application.id, "invite_token": token, "invite_link": f"/apply?token={token}"}
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while creating invite: {e}")
        raise Exception(f"Database error while creating invite: {e}")


async def create_application(db: AsyncSession, hostel_id: int, payload: OnboardingRequest, token: str | None = None) -> dict:
    """Create a pending onboarding application from the public form."""
    try:
        logger.info("Fetching user from DB for application")
        result = await db.execute(select(User).where(User.phone == payload.phone))
        if result.scalars().first():
            raise ValueError("Phone already registered")
        result = await db.execute(select(Resident).where(Resident.cnic_number == payload.cnic_number))
        if result.scalars().first():
            raise ValueError("CNIC already registered")
        result = await db.execute(
            select(Application).where(
                Application.cnic_number == payload.cnic_number,
                Application.status == ApplicationStatus.PENDING.value,
            )
        )
        if result.scalars().first():
            raise ValueError("An application with this CNIC is already pending")
        application = Application(
            hostel_id=hostel_id,
            invite_token=token,
            full_name=payload.full_name,
            father_name=payload.father_name,
            phone=payload.phone,
            guardian_phone=payload.guardian_phone,
            cnic_number=payload.cnic_number,
            password_hash=hash_password(payload.password),
            start_date=payload.start_date,
            monthly_rent=payload.monthly_rent,
            security_paid=payload.security_paid,
            status=ApplicationStatus.PENDING.value,
        )
        db.add(application)
        await db.commit()
        await db.refresh(application)
        logger.info("Application submitted successfully.")
        return {
            "id": application.id,
            "full_name": application.full_name,
            "phone": application.phone,
            "cnic_number": application.cnic_number,
            "start_date": application.start_date.isoformat(),
            "monthly_rent": application.monthly_rent,
            "security_paid": application.security_paid,
            "status": application.status,
        }
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while creating application: {e}")
        raise Exception(f"Database error while creating application: {e}")


async def list_applications(db: AsyncSession, hostel_id: int) -> list[dict]:
    """List applications in the admin's hostel (pending first)."""
    try:
        logger.info("Fetching applications from DB")
        result = await db.execute(
            select(Application)
            .where(Application.hostel_id == hostel_id)
            .order_by(Application.created_at.desc())
        )
        rows = result.scalars().all()
        out = []
        for a in rows:
            # Skip placeholder invite rows that have no real application data.
            if not a.cnic_number:
                continue
            out.append(
                {
                    "id": a.id,
                    "full_name": a.full_name,
                    "phone": a.phone,
                    "cnic_number": a.cnic_number,
                    "start_date": a.start_date.isoformat(),
                    "monthly_rent": a.monthly_rent,
                    "security_paid": a.security_paid,
                    "status": a.status,
                }
            )
        logger.info("Applications fetched successfully.")
        return out
    except Exception as e:
        logger.error(f"Database error while fetching applications: {e}")
        raise Exception(f"Database error while fetching applications: {e}")


async def approve_application(
    db: AsyncSession,
    hostel_id: int,
    application_id: int,
    seat_id: int,
    extras: list | None = None,
) -> dict:
    """Approve an application: create User + Resident, occupy the seat."""
    try:
        logger.info("Fetching application from DB")
        result = await db.execute(
            select(Application).where(
                Application.id == application_id, Application.hostel_id == hostel_id
            )
        )
        application = result.scalars().first()
        if application is None:
            raise LookupError("Application not found")
        if application.status != ApplicationStatus.PENDING.value:
            raise ValueError("Application is not pending")
        result = await db.execute(select(User).where(User.phone == application.phone))
        if result.scalars().first():
            raise ValueError("Phone already registered")
        seat, room, building = await _get_vacant_seat_in_hostel(db, hostel_id, seat_id)
        user = User(
            hostel_id=hostel_id,
            role=UserRole.RESIDENT.value,
            full_name=application.full_name,
            phone=application.phone,
            password_hash=application.password_hash,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        resident = Resident(
            user_id=user.id,
            hostel_id=hostel_id,
            seat_id=seat.id,
            father_name=application.father_name,
            guardian_phone=application.guardian_phone,
            cnic_number=application.cnic_number,
            start_date=application.start_date,
            monthly_rent=application.monthly_rent,
            security_paid=application.security_paid,
            status="active",
        )
        db.add(resident)
        seat.status = SeatStatus.OCCUPIED.value
        application.status = ApplicationStatus.APPROVED.value
        await db.commit()
        await db.refresh(resident)
        from app.services.admin import extra_charge_service

        # Extras BEFORE the first cycle, so its total includes them.
        await extra_charge_service.create_extras_for_resident(db, resident.id, extras)
        await db.commit()
        await rent_service.create_first_cycle(db, resident)
        logger.info("Application approved successfully.")
        return await _summary(db, hostel_id, resident)
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while approving application: {e}")
        raise Exception(f"Database error while approving application: {e}")


async def reject_application(db: AsyncSession, hostel_id: int, application_id: int, reason: str | None = None) -> dict:
    """Reject a pending application."""
    try:
        logger.info("Fetching application from DB")
        result = await db.execute(
            select(Application).where(
                Application.id == application_id, Application.hostel_id == hostel_id
            )
        )
        application = result.scalars().first()
        if application is None:
            raise LookupError("Application not found")
        if application.status != ApplicationStatus.PENDING.value:
            raise ValueError("Application is not pending")
        application.status = ApplicationStatus.REJECTED.value
        application.reject_reason = reason
        await db.commit()
        logger.info("Application rejected successfully.")
        return {"id": application.id, "status": application.status}
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while rejecting application: {e}")
        raise Exception(f"Database error while rejecting application: {e}")
