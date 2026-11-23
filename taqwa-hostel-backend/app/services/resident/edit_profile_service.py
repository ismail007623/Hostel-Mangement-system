"""Resident edit-profile requests (Phase 2).

Rule (locked):
- A request with ONLY guardian_phone / guardian_name is applied
  immediately — it is low risk.
- A request with full_name / phone / cnic_number is stored as PENDING
  and is NOT applied until the admin approves it, because the phone
  is the login id and the CNIC is the identity.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.profile_edit import ProfileEditRequest, ProfileEditStatus
from app.models.resident import Resident
from app.models.user import User
from app.schemas.resident.profile import EditProfileRequest

logger = get_logger(__name__)

GUARDIAN_ONLY_FIELDS = {"guardian_phone", "guardian_name"}
NEEDS_APPROVAL_FIELDS = {"full_name", "phone", "cnic_number"}


async def _resident_for_user(db: AsyncSession, user: User) -> Resident | None:
    """Return the resident row for this login user, or None."""
    try:
        logger.info("Fetching resident from DB")
        result = await db.execute(select(Resident).where(Resident.user_id == user.id))
        resident = result.scalars().first()
        logger.info("Resident fetched successfully.")
        return resident
    except Exception as e:
        logger.error(f"Database error while fetching resident: {e}")
        raise Exception(f"Database error while fetching resident: {e}")


def _serialize(request: ProfileEditRequest) -> dict:
    """Serialize one edit request."""
    return {
        "id": request.id,
        "resident_id": request.resident_id,
        "requested_changes": request.changes(),
        "status": request.status,
        "reason": request.reason,
        "created_at": request.created_at.isoformat() if request.created_at else None,
    }


async def submit_edit_request(db: AsyncSession, user: User, payload: EditProfileRequest) -> dict:
    """Submit an edit request for the logged-in resident only.

    Guardian-only changes are applied immediately. Anything else
    creates a PENDING request for the admin.

    Returns:
        A dict with ``applied`` (True when applied immediately) and
        either the updated profile or the created request.
    """
    try:
        logger.info("Fetching resident from DB for edit request")
        resident = await _resident_for_user(db, user)
        if resident is None:
            raise LookupError("Resident profile not found")
        changes = payload.model_dump(exclude_none=True)
        if not changes:
            raise ValueError("At least one field is required")
        keys = set(changes)
        if keys <= GUARDIAN_ONLY_FIELDS:
            if "guardian_phone" in changes:
                resident.guardian_phone = changes["guardian_phone"]
            if "guardian_name" in changes:
                resident.guardian_name = changes["guardian_name"]
            await db.commit()
            await db.refresh(resident)
            logger.info("Guardian details updated successfully.")
            return {"applied": True, "guardian_phone": resident.guardian_phone, "guardian_name": resident.guardian_name}
        request = ProfileEditRequest(resident_id=resident.id, hostel_id=user.hostel_id)
        request.set_changes(changes)
        db.add(request)
        await db.commit()
        await db.refresh(request)
        logger.info("Edit request created successfully.")
        return {"applied": False, "request": _serialize(request)}
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while submitting edit request: {e}")
        raise Exception(f"Database error while submitting edit request: {e}")


async def list_own_requests(db: AsyncSession, user: User) -> list[dict]:
    """List the logged-in resident's own edit requests, newest first."""
    try:
        logger.info("Fetching edit requests from DB")
        resident = await _resident_for_user(db, user)
        if resident is None:
            raise LookupError("Resident profile not found")
        result = await db.execute(
            select(ProfileEditRequest)
            .where(ProfileEditRequest.resident_id == resident.id)
            .order_by(ProfileEditRequest.created_at.desc(), ProfileEditRequest.id.desc())
        )
        rows = result.scalars().all()
        logger.info("Edit requests fetched successfully.")
        return [_serialize(r) for r in rows]
    except LookupError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching edit requests: {e}")
        raise Exception(f"Database error while fetching edit requests: {e}")


async def list_requests(db: AsyncSession, hostel_id: int, status: str | None = None) -> list[dict]:
    """List edit requests in the admin's hostel, newest first."""
    try:
        logger.info("Fetching edit requests from DB")
        stmt = select(ProfileEditRequest).where(ProfileEditRequest.hostel_id == hostel_id)
        if status:
            if status not in [s.value for s in ProfileEditStatus]:
                raise ValueError("Invalid status filter")
            stmt = stmt.where(ProfileEditRequest.status == status)
        result = await db.execute(
            stmt.order_by(ProfileEditRequest.created_at.desc(), ProfileEditRequest.id.desc())
        )
        rows = result.scalars().all()
        out = []
        for request in rows:
            result = await db.execute(select(Resident).where(Resident.id == request.resident_id))
            resident = result.scalars().first()
            user = None
            if resident:
                result = await db.execute(select(User).where(User.id == resident.user_id))
                user = result.scalars().first()
            data = _serialize(request)
            data["full_name"] = user.full_name if user else ""
            data["phone"] = user.phone if user else ""
            out.append(data)
        logger.info("Edit requests fetched successfully.")
        return out
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Database error while fetching edit requests: {e}")
        raise Exception(f"Database error while fetching edit requests: {e}")


async def approve_request(db: AsyncSession, hostel_id: int, request_id: int, admin_id: int) -> dict:
    """Approve a pending edit request and apply the changes.

    Phone / CNIC uniqueness is checked again at approval time, so a
    change can never create a duplicate login or identity.
    """
    try:
        logger.info("Fetching edit request from DB")
        result = await db.execute(
            select(ProfileEditRequest).where(
                ProfileEditRequest.id == request_id, ProfileEditRequest.hostel_id == hostel_id
            )
        )
        request = result.scalars().first()
        if request is None:
            raise LookupError("Edit request not found")
        if request.status != ProfileEditStatus.PENDING.value:
            raise ValueError("Edit request is not pending")
        result = await db.execute(select(Resident).where(Resident.id == request.resident_id))
        resident = result.scalars().first()
        if resident is None:
            raise LookupError("Resident not found")
        result = await db.execute(select(User).where(User.id == resident.user_id))
        user = result.scalars().first()
        if user is None:
            raise LookupError("Resident user not found")
        changes = request.changes()
        if "phone" in changes and changes["phone"] != user.phone:
            result = await db.execute(select(User).where(User.phone == changes["phone"]))
            if result.scalars().first():
                raise ValueError("Phone already registered")
            user.phone = changes["phone"]
        if "cnic_number" in changes and changes["cnic_number"] != resident.cnic_number:
            result = await db.execute(select(Resident).where(Resident.cnic_number == changes["cnic_number"]))
            if result.scalars().first():
                raise ValueError("CNIC already registered")
            resident.cnic_number = changes["cnic_number"]
        if "full_name" in changes:
            user.full_name = changes["full_name"]
        if "guardian_phone" in changes:
            resident.guardian_phone = changes["guardian_phone"]
        if "guardian_name" in changes:
            resident.guardian_name = changes["guardian_name"]
        request.status = ProfileEditStatus.APPROVED.value
        request.reviewed_by = admin_id
        await db.commit()
        await db.refresh(request)
        logger.info("Edit request approved successfully.")
        return _serialize(request)
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while approving edit request: {e}")
        raise Exception(f"Database error while approving edit request: {e}")


async def reject_request(db: AsyncSession, hostel_id: int, request_id: int, admin_id: int, reason: str) -> dict:
    """Reject a pending edit request. Nothing is changed."""
    try:
        logger.info("Fetching edit request from DB")
        result = await db.execute(
            select(ProfileEditRequest).where(
                ProfileEditRequest.id == request_id, ProfileEditRequest.hostel_id == hostel_id
            )
        )
        request = result.scalars().first()
        if request is None:
            raise LookupError("Edit request not found")
        if request.status != ProfileEditStatus.PENDING.value:
            raise ValueError("Edit request is not pending")
        request.status = ProfileEditStatus.REJECTED.value
        request.reason = reason
        request.reviewed_by = admin_id
        await db.commit()
        await db.refresh(request)
        logger.info("Edit request rejected successfully.")
        return _serialize(request)
    except (LookupError, ValueError):
        raise
    except Exception as e:
        logger.error(f"Database error while rejecting edit request: {e}")
        raise Exception(f"Database error while rejecting edit request: {e}")
