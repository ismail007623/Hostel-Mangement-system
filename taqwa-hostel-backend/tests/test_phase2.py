"""Phase 2 tests (TestClient, in-memory SQLite).

Reuses the Phase 1 test app/client/seed helpers so both test files
share one in-memory database and one dependency override. Covers:
rent-cycle auto-creation, partial/full payment approval, next-cycle
creation from the previous due date, rejection, cross-resident
protection, due-list overdue after grace, guardian direct edit vs
name/phone approval flow, amount > remaining, and non-image upload.
"""

from datetime import date, timedelta

from tests.conftest import ADMIN_PASS, ADMIN_PHONE, TestingSession, _auth, _login, _seed, client
from app.models.user import User

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


async def _ensure_seed() -> None:
    """Seed the admin/hostel when this file runs without Phase 1 tests."""
    from sqlalchemy import select

    async with TestingSession() as db:
        result = await db.execute(select(User).where(User.phone == ADMIN_PHONE))
        exists = result.scalars().first() is not None
    if not exists:
        await _seed()


async def _admin_headers() -> dict:
    """Log in as the seed admin and return auth headers."""
    await _ensure_seed()
    return _auth((await _login(ADMIN_PHONE, ADMIN_PASS))["access_token"])


async def _make_room(room_number: str, room_type: str = "2-seater") -> tuple[int, list[int]]:
    """Create a building + room and return (room_id, seat_ids)."""
    headers = await _admin_headers()
    r = await client.post("/api/v1/admin/buildings", json={"name": f"Building {room_number}"}, headers=headers)
    assert r.status_code == 201, r.text
    building_id = r.json()["data"]["id"]
    r = await client.post(
        f"/api/v1/admin/buildings/{building_id}/rooms",
        json={"room_number": room_number, "room_type": room_type},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    room_id = r.json()["data"]["id"]
    r = await client.get(f"/api/v1/admin/rooms/{room_id}/seats", headers=headers)
    assert r.status_code == 200, r.text
    return room_id, [s["id"] for s in r.json()["data"]]


async def _approve_resident(phone: str, cnic: str, seat_id: int, start_date: str, rent: int = 8000) -> dict:
    """Apply + approve one resident and return their login data."""
    payload = {
        "full_name": "Test Resident", "father_name": "Test Father",
        "phone": phone, "guardian_phone": "03003334444",
        "cnic_number": cnic, "password": "Resident1",
        "start_date": start_date, "monthly_rent": rent, "security_paid": 10000,
    }
    r = await client.post("/api/v1/public/apply", json=payload)
    assert r.status_code == 201, r.text
    app_id = r.json()["data"]["id"]
    headers = await _admin_headers()
    r = await client.post(f"/api/v1/admin/applications/{app_id}/approve", json={"seat_id": seat_id}, headers=headers)
    assert r.status_code == 200, r.text
    return await _login(phone, "Resident1")


async def _current_cycle(resident_headers: dict) -> dict:
    """Return the resident's current rent cycle."""
    r = await client.get("/api/v1/resident/rent/current", headers=resident_headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]


async def _submit_payment(resident_headers: dict, cycle_id: int, amount: int, filename: str = "receipt.png", content: bytes = PNG_BYTES, mime: str = "image/png"):
    """Submit a rent payment as multipart form."""
    return await client.post(
        "/api/v1/resident/payments",
        data={"rent_cycle_id": str(cycle_id), "amount": str(amount), "method": "JazzCash"},
        files={"screenshot": (filename, content, mime)},
        headers=resident_headers,
    )


async def test_cycle_auto_created_on_approve_with_due_start_plus_30():
    """Approving an application creates a cycle due start + 30 days."""
    _room_id, seat_ids = await _make_room("201")
    resident = await _approve_resident("03001110001", "35202-1111111-1", seat_ids[0], "2026-11-01")
    cycle = await _current_cycle(_auth(resident["access_token"]))
    assert cycle["start_date"] == "2026-11-01"
    assert cycle["due_date"] == "2026-12-01"
    assert cycle["total_amount"] == 8000
    assert cycle["paid_amount"] == 0
    assert cycle["remaining"] == 8000
    assert cycle["status"] == "due"


async def test_partial_payment_approve_then_full_payment_creates_next_cycle():
    """Partial approve leaves remaining; full approve pays and creates the next cycle from the old due date."""
    _room_id, seat_ids = await _make_room("202")
    resident = await _approve_resident("03001110002", "35202-2222222-2", seat_ids[0], "2026-11-01")
    headers = _auth(resident["access_token"])
    admin = await _admin_headers()
    cycle = await _current_cycle(headers)
    cycle_id = cycle["id"]

    # Partial payment of 3000.
    r = await _submit_payment(headers, cycle_id, 3000)
    assert r.status_code == 201, r.text
    payment_id = r.json()["data"]["id"]
    assert r.json()["data"]["status"] == "pending"
    # Cycle is unchanged until the admin approves.
    assert (await _current_cycle(headers))["paid_amount"] == 0

    r = await client.post(f"/api/v1/admin/payments/{payment_id}/approve", headers=admin)
    assert r.status_code == 200, r.text
    cycle = await _current_cycle(headers)
    assert cycle["paid_amount"] == 3000
    assert cycle["remaining"] == 5000
    assert cycle["status"] == "partial"

    # Pay the rest: fully paid, next cycle starts from the old due date.
    r = await _submit_payment(headers, cycle_id, 5000)
    assert r.status_code == 201, r.text
    payment_id2 = r.json()["data"]["id"]
    r = await client.post(f"/api/v1/admin/payments/{payment_id2}/approve", headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["next_cycle"]["start_date"] == "2026-12-01"
    assert r.json()["data"]["next_cycle"]["due_date"] == "2026-12-31"
    assert r.json()["data"]["next_cycle"]["total_amount"] == 8000
    new_cycle = await _current_cycle(headers)
    assert new_cycle["id"] != cycle_id
    assert new_cycle["start_date"] == "2026-12-01"
    assert new_cycle["remaining"] == 8000

    # Paid list shows the finished cycle.
    r = await client.get("/api/v1/admin/rent/paid-list", headers=admin)
    assert r.status_code == 200, r.text
    assert any(row["cycle"]["id"] == cycle_id for row in r.json()["data"])


async def test_reject_payment_leaves_cycle_unchanged():
    """A rejected payment does not change the rent cycle."""
    _room_id, seat_ids = await _make_room("203")
    resident = await _approve_resident("03001110003", "35202-3333333-3", seat_ids[0], "2026-11-01")
    headers = _auth(resident["access_token"])
    admin = await _admin_headers()
    cycle_id = (await _current_cycle(headers))["id"]
    r = await _submit_payment(headers, cycle_id, 8000)
    assert r.status_code == 201, r.text
    payment_id = r.json()["data"]["id"]
    r = await client.post(
        f"/api/v1/admin/payments/{payment_id}/reject",
        json={"reason": "Screenshot is not clear"},
        headers=admin,
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "rejected"
    cycle = await _current_cycle(headers)
    assert cycle["paid_amount"] == 0
    assert cycle["remaining"] == 8000


async def test_resident_cannot_pay_for_another_resident_cycle():
    """Paying for another resident's cycle is forbidden (403)."""
    _room_id, seat_ids = await _make_room("204")
    resident_a = await _approve_resident("03001110004", "35202-4444444-4", seat_ids[0], "2026-11-01")
    _room_id2, seat_ids2 = await _make_room("205")
    resident_b = await _approve_resident("03001110005", "35202-5555555-5", seat_ids2[0], "2026-11-01")
    cycle_b = await _current_cycle(_auth(resident_b["access_token"]))
    r = await _submit_payment(_auth(resident_a["access_token"]), cycle_b["id"], 1000)
    assert r.status_code == 403, r.text
    assert r.json()["succeed"] is False


async def test_amount_more_than_remaining_rejected():
    """A payment bigger than the remaining rent is rejected (400)."""
    _room_id, seat_ids = await _make_room("206")
    resident = await _approve_resident("03001110006", "35202-6666666-6", seat_ids[0], "2026-11-01")
    headers = _auth(resident["access_token"])
    cycle_id = (await _current_cycle(headers))["id"]
    r = await _submit_payment(headers, cycle_id, 9000)
    assert r.status_code == 400, r.text
    assert r.json()["succeed"] is False


async def test_non_image_screenshot_rejected():
    """A .txt upload is rejected; only png/jpg/jpeg are allowed."""
    _room_id, seat_ids = await _make_room("207")
    resident = await _approve_resident("03001110007", "35202-7777777-7", seat_ids[0], "2026-11-01")
    headers = _auth(resident["access_token"])
    cycle_id = (await _current_cycle(headers))["id"]
    r = await _submit_payment(headers, cycle_id, 1000, filename="receipt.txt", content=b"not an image", mime="text/plain")
    assert r.status_code == 400, r.text
    assert r.json()["succeed"] is False


async def test_due_list_overdue_after_grace_and_due_soon():
    """Overdue appears only after due date + grace; due-soon within 3 days."""
    # Started 2026-09-01: due 2026-10-01, grace 3 days -> long overdue.
    _room_id, seat_ids = await _make_room("208")
    await _approve_resident("03001110008", "35202-8888888-8", seat_ids[0], "2026-09-01")
    # Started 28 days ago: due in 2 days -> due soon.
    start_soon = (date.today() - timedelta(days=28)).isoformat()
    _room_id2, seat_ids2 = await _make_room("209")
    await _approve_resident("03001110009", "35202-9999999-9", seat_ids2[0], start_soon)
    admin = await _admin_headers()

    r = await client.get("/api/v1/admin/rent/due-list?status=overdue", headers=admin)
    assert r.status_code == 200, r.text
    overdue = r.json()["data"]
    assert any(row["phone"] == "03001110008" for row in overdue)
    assert all(row["phone"] != "03001110009" for row in overdue)
    row = next(row for row in overdue if row["phone"] == "03001110008")
    assert row["whatsapp_url"].startswith("https://wa.me/923001110008?text=")
    assert row["status"] == "overdue"

    r = await client.get("/api/v1/admin/rent/due-list?status=due_soon", headers=admin)
    assert r.status_code == 200, r.text
    assert any(row["phone"] == "03001110009" for row in r.json()["data"])

    r = await client.get("/api/v1/admin/dashboard", headers=admin)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["total_residents"] >= 2
    assert data["overdue_count"] >= 1
    assert data["due_count"] >= 1
    assert "paid_this_month" in data


async def test_guardian_edit_direct_but_name_phone_needs_approval():
    """Guardian-only edit applies at once; name/phone waits for admin approval."""
    _room_id, seat_ids = await _make_room("210")
    resident = await _approve_resident("03001110010", "35202-1010101-0", seat_ids[0], "2026-11-01")
    headers = _auth(resident["access_token"])
    admin = await _admin_headers()

    # Guardian-only: applied immediately.
    r = await client.post(
        "/api/v1/resident/profile/edit-request",
        json={"guardian_phone": "03009998888"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["applied"] is True
    r = await client.get("/api/v1/resident/me", headers=headers)
    assert r.json()["data"]["full_name"] == "Test Resident"

    # Name change: stored pending, profile unchanged.
    r = await client.post(
        "/api/v1/resident/profile/edit-request",
        json={"full_name": "New Name"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["applied"] is False
    request_id = r.json()["data"]["request"]["id"]
    r = await client.get("/api/v1/resident/me", headers=headers)
    assert r.json()["data"]["full_name"] == "Test Resident"

    # Admin approves: now the name changes.
    r = await client.post(f"/api/v1/admin/profile-edit-requests/{request_id}/approve", headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "approved"
    r = await client.get("/api/v1/resident/me", headers=headers)
    assert r.json()["data"]["full_name"] == "New Name"

    # A rejected phone change never applies.
    r = await client.post(
        "/api/v1/resident/profile/edit-request",
        json={"phone": "03001110099"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    request_id2 = r.json()["data"]["request"]["id"]
    r = await client.post(
        f"/api/v1/admin/profile-edit-requests/{request_id2}/reject",
        json={"reason": "Wrong number"},
        headers=admin,
    )
    assert r.status_code == 200, r.text
    data = await _login("03001110010", "Resident1")
    assert data["role"] == "resident"


async def test_rent_history_is_own_only():
    """Rent history shows only the logged-in resident's cycles/payments."""
    _room_id, seat_ids = await _make_room("211")
    resident = await _approve_resident("03001110011", "35202-1212121-2", seat_ids[0], "2026-11-01")
    headers = _auth(resident["access_token"])
    r = await client.get("/api/v1/resident/rent-history", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data["cycles"]) == 1
    assert data["cycles"][0]["total_amount"] == 8000
    assert data["payments"] == []
    # Resident cannot approve payments (admin only).
    r = await client.post("/api/v1/admin/payments/1/approve", headers=headers)
    assert r.status_code in (401, 403)
