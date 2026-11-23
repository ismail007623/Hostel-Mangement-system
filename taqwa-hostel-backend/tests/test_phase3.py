"""Phase 3 tests (TestClient, in-memory SQLite).

Covers only what Phase 3 added to the backend:
- GET /api/v1/public/seats/by-room returns live per-room vacant/total
  counts (no names, phones, or CNICs).
- Uploaded rent screenshots are served under /uploads (so the admin
  can view a screenshot when approving a payment).

Shared setup (engine, client, seed, login helpers) lives in
``tests/conftest.py``.
"""

import io

from tests.conftest import _auth, _login, _seed, client


async def _admin_headers():
    """Log in as the seed admin and return auth headers."""
    await _seed()
    data = await _login("03004493800", "Taqwa@123")
    return _auth(data["access_token"])


async def _make_room(headers, building_name="Building 1", room_number="111"):
    """Create one building + one 2-seater room; return its room id."""
    r = await client.post("/api/v1/admin/buildings", json={"name": building_name}, headers=headers)
    assert r.status_code == 201, r.text
    building_id = r.json()["data"]["id"]
    r = await client.post(
        f"/api/v1/admin/buildings/{building_id}/rooms",
        json={"room_number": room_number, "room_type": "2-seater"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]["id"]


async def test_public_seats_by_room_live_counts():
    """By-room seats show live vacant/total counts, no private data."""
    headers = await _admin_headers()
    await _make_room(headers, building_name="P3 Building A", room_number="301")
    r = await client.get("/api/v1/public/seats/by-room")
    assert r.status_code == 200
    assert r.json()["succeed"] is True
    rows = r.json()["data"]
    assert isinstance(rows, list) and len(rows) >= 1
    row = next(x for x in rows if x["room_number"] == "301")
    assert row["building"] == "P3 Building A"
    assert row["room_type"] == "2-seater"
    assert row["vacant_seats"] == 2
    assert row["total_seats"] == 2
    assert "phone" not in row and "cnic" not in str(row).lower()


async def test_public_seats_by_room_shape():
    """Every by-room row has the landing page's fields and no private data."""
    r = await client.get("/api/v1/public/seats/by-room")
    assert r.status_code == 200
    assert r.json()["succeed"] is True
    rows = r.json()["data"]
    assert isinstance(rows, list)
    for row in rows:
        assert {"building", "room_number", "room_type", "vacant_seats", "total_seats"} <= set(row)
        assert "phone" not in row and "cnic_number" not in row


async def test_uploads_static_serves_screenshot():
    """An uploaded payment screenshot is viewable under /uploads."""
    headers = await _admin_headers()
    room_id = await _make_room(headers, building_name="P3 Building B", room_number="302")
    r = await client.get(f"/api/v1/admin/rooms/{room_id}/seats", headers=headers)
    seat_id = r.json()["data"][0]["id"]
    payload = {
        "full_name": "Test Resident",
        "father_name": "Test Father",
        "phone": "03001113333",
        "guardian_phone": "03003334444",
        "cnic_number": "35202-1234567-2",
        "password": "Resident@123",
        "start_date": "2026-11-01",
        "monthly_rent": 8000,
        "security_paid": 10000,
        "seat_id": seat_id,
    }
    r = await client.post("/api/v1/admin/residents", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    resident_token = (await _login("03001113333", "Resident@123"))["access_token"]
    r = await client.get("/api/v1/resident/rent/current", headers=_auth(resident_token))
    assert r.status_code == 200, r.text
    cycle_id = r.json()["data"]["id"]
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    r = await client.post(
        "/api/v1/resident/payments",
        headers=_auth(resident_token),
        data={"rent_cycle_id": cycle_id, "amount": 8000, "method": "JazzCash"},
        files={"screenshot": ("receipt.png", io.BytesIO(fake_png), "image/png")},
    )
    assert r.status_code == 201, r.text
    screenshot_url = r.json()["data"]["screenshot_url"]
    assert screenshot_url.startswith("uploads/")
    r = await client.get(f"/{screenshot_url}")
    assert r.status_code == 200
    assert r.content[:8] == fake_png[:8]
