"""Phase 1 tests (TestClient, in-memory SQLite).

Covers: login success/fail, dashboard, building/room/seat creation,
onboarding -> approve -> resident login, resident isolation, and
bad phone/CNIC rejected with 422 + envelope.

Shared setup (engine, client, seed, login helpers) lives in
``tests/conftest.py`` so Phase 1 and Phase 2 tests share one
in-memory database.
"""

from tests.conftest import ADMIN_PASS, ADMIN_PHONE, _auth, _login, _seed, client


async def test_login_success_and_fail():
    """Login works with correct password and fails with a wrong one."""
    await _seed()
    data = await _login(ADMIN_PHONE, ADMIN_PASS)
    assert data["role"] == "admin"
    assert data["access_token"]
    r = await client.post("/api/v1/auth/login", json={"phone": ADMIN_PHONE, "password": "WrongPass1"})
    assert r.status_code == 401
    assert r.json()["succeed"] is False


async def test_dashboard_and_building_room_seats():
    """Dashboard counts; room creation auto-creates 2/3/4 seats."""
    token = (await _login(ADMIN_PHONE, ADMIN_PASS))["access_token"]
    headers = _auth(token)
    r = await client.get("/api/v1/admin/dashboard", headers=headers)
    assert r.status_code == 200 and r.json()["succeed"] is True
    assert r.json()["data"]["total_buildings"] == 0
    r = await client.post("/api/v1/admin/buildings", json={"name": "Building 1"}, headers=headers)
    assert r.status_code == 201, r.text
    building_id = r.json()["data"]["id"]
    r = await client.post(f"/api/v1/admin/buildings/{building_id}/rooms",
                    json={"room_number": "111", "room_type": "2-seater"}, headers=headers)
    assert r.status_code == 201, r.text
    room_id = r.json()["data"]["id"]
    r = await client.get(f"/api/v1/admin/rooms/{room_id}/seats", headers=headers)
    assert r.status_code == 200
    assert len(r.json()["data"]) == 2  # 2-seater -> 2 seats
    r = await client.get("/api/v1/admin/dashboard", headers=headers)
    assert r.json()["data"]["total_seats"] == 2
    assert r.json()["data"]["vacant_seats"] == 2


async def test_onboarding_approve_then_resident_login_and_isolation():
    """Apply -> approve with seat -> resident can log in and see only own room."""
    token = (await _login(ADMIN_PHONE, ADMIN_PASS))["access_token"]
    headers = _auth(token)
    r = await client.get("/api/v1/admin/buildings", headers=headers)
    building_id = r.json()["data"]["items"][0]["id"]
    r = await client.get(f"/api/v1/admin/buildings/{building_id}/rooms", headers=headers)
    room_id = r.json()["data"]["items"][0]["id"]
    r = await client.get(f"/api/v1/admin/rooms/{room_id}/seats", headers=headers)
    seat_id = r.json()["data"][0]["id"]

    payload = {
        "full_name": "Ali Raza", "father_name": "Ahmed Raza",
        "phone": "03001112222", "guardian_phone": "03003334444",
        "cnic_number": "35202-1234567-1", "password": "Resident1",
        "start_date": "2026-11-01", "monthly_rent": 8000, "security_paid": 10000,
    }
    r = await client.post("/api/v1/public/apply", json=payload)
    assert r.status_code == 201, r.text
    app_id = r.json()["data"]["id"]

    # Resident cannot log in before approval.
    r = await client.post("/api/v1/auth/login", json={"phone": "03001112222", "password": "Resident1"})
    assert r.status_code == 401

    r = await client.post(f"/api/v1/admin/applications/{app_id}/approve",
                    json={"seat_id": seat_id}, headers=headers)
    assert r.status_code == 200, r.text

    resident = await _login("03001112222", "Resident1")
    assert resident["role"] == "resident"
    r = await client.get("/api/v1/resident/my-room", headers=_auth(resident["access_token"]))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["room_number"] == "111"
    # next_due_date = 2026-11-01 + 30 days = 2026-12-01
    assert r.json()["data"]["next_due_date"] == "2026-12-01"

    # Resident cannot use admin endpoints.
    r = await client.get("/api/v1/admin/dashboard", headers=_auth(resident["access_token"]))
    assert r.status_code in (401, 403)

    # A second resident with the same name is allowed (name is not unique).
    payload2 = dict(payload, phone="03005556666", cnic_number="35202-7654321-1")
    r = await client.post("/api/v1/public/apply", json=payload2)
    assert r.status_code == 201, r.text


async def test_bad_phone_and_cnic_rejected():
    """Bad phone / CNIC are rejected with 422 and the envelope."""
    r = await client.post("/api/v1/public/apply", json={
        "full_name": "Bad", "father_name": "Bad",
        "phone": "123", "guardian_phone": "03003334444",
        "cnic_number": "bad", "password": "Resident1",
        "start_date": "2026-11-01", "monthly_rent": 8000, "security_paid": 0,
    })
    assert r.status_code == 422
    assert r.json()["succeed"] is False


async def test_public_seats_no_private_data():
    """Public seats endpoint returns counts only, no names or phones."""
    r = await client.get("/api/v1/public/seats")
    assert r.status_code == 200
    body = r.text
    assert "0300" not in body
    assert "Ali" not in body
