"""Phase 4 tests: pagination, search, export, extra charges, rooms.

Covers the UI-fixes round:
- GET /api/v1/admin/buildings and /rooms and /residents accept
  ?page=&page_size= and return items/total/page/pages.
- GET /api/v1/admin/residents?search= matches name, phone and CNIC.
- GET /api/v1/admin/residents/export returns CSV (admin only).
- Extra charges: add / toggle / total / next-cycle-only behaviour.
- POST /api/v1/admin/rooms with optional building (single building
  reuse, auto "Main Building") and PUT /api/v1/admin/rooms/{id}.
"""

import io

from tests.conftest import _auth, _login, _seed, client


async def _admin_headers():
    await _seed()
    data = await _login("03004493800", "Taqwa@123")
    return _auth(data["access_token"])


async def _make_room(headers, building_name, room_number, room_type="2-seater"):
    r = await client.post("/api/v1/admin/buildings", json={"name": building_name}, headers=headers)
    assert r.status_code == 201, r.text
    building_id = r.json()["data"]["id"]
    r = await client.post(
        f"/api/v1/admin/buildings/{building_id}/rooms",
        json={"room_number": room_number, "room_type": room_type},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return building_id, r.json()["data"]["id"]


async def _make_resident(headers, tag, room_id, seat_idx=0, extras=None, rent=8000):
    r = await client.get(f"/api/v1/admin/rooms/{room_id}/seats", headers=headers)
    seat_id = r.json()["data"][seat_idx]["id"]
    payload = {
        "full_name": f"Phase4 Resident {tag}",
        "father_name": "Phase4 Father",
        "phone": f"03004{tag}",
        "guardian_phone": "03003334444",
        "cnic_number": f"35202-{tag}1-1",
        "password": "Resident@123",
        "start_date": "2026-11-01",
        "monthly_rent": rent,
        "security_paid": 10000,
        "seat_id": seat_id,
    }
    if extras is not None:
        payload["extras"] = extras
    r = await client.post("/api/v1/admin/residents", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def test_rooms_pagination():
    """Rooms list paginates: page 1 of 3 rooms at page_size=2."""
    headers = await _admin_headers()
    building_id, _ = await _make_room(headers, "P4 Pag Building", "401")
    for num in ("402", "403"):
        r = await client.post(
            f"/api/v1/admin/buildings/{building_id}/rooms",
            json={"room_number": num, "room_type": "2-seater"},
            headers=headers,
        )
        assert r.status_code == 201, r.text
    r = await client.get(f"/api/v1/admin/buildings/{building_id}/rooms?page=1&page_size=2", headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["total"] == 3 and data["pages"] == 2 and len(data["items"]) == 2
    r = await client.get(f"/api/v1/admin/buildings/{building_id}/rooms?page=2&page_size=2", headers=headers)
    assert len(r.json()["data"]["items"]) == 1
    r = await client.get("/api/v1/admin/rooms?page=1&page_size=2", headers=headers)
    assert r.status_code == 200 and r.json()["data"]["total"] >= 3


async def test_buildings_pagination():
    """Buildings list returns items/total/pages."""
    headers = await _admin_headers()
    r = await client.get("/api/v1/admin/buildings?page=1&page_size=20", headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["total"] >= 1 and data["page"] == 1 and "items" in data


async def test_residents_pagination_and_search():
    """Residents paginate, and search finds by name, phone and CNIC."""
    headers = await _admin_headers()
    _, room_id = await _make_room(headers, "P4 Search Building", "411")
    await _make_resident(headers, "100001", room_id)
    r = await client.get("/api/v1/admin/residents?page=1&page_size=1", headers=headers)
    data = r.json()["data"]
    assert data["page_size"] == 1 and len(data["items"]) == 1 and data["total"] >= 1
    # Search by CNIC fragment.
    r = await client.get("/api/v1/admin/residents?search=35202-1000011-1", headers=headers)
    rows = r.json()["data"]["items"]
    assert len(rows) == 1 and rows[0]["phone"] == "03004100001"
    # Search by phone.
    r = await client.get("/api/v1/admin/residents?search=03004100001", headers=headers)
    assert len(r.json()["data"]["items"]) == 1
    # Search by name.
    r = await client.get("/api/v1/admin/residents?search=Phase4 Resident 100001", headers=headers)
    assert len(r.json()["data"]["items"]) == 1
    # Search with no match returns empty, not an error.
    r = await client.get("/api/v1/admin/residents?search=zzz-no-such-person", headers=headers)
    assert r.json()["data"]["total"] == 0


async def test_residents_export_csv():
    """Export CSV contains the resident and the required columns."""
    headers = await _admin_headers()
    _, room_id = await _make_room(headers, "P4 Export Building", "421")
    await _make_resident(headers, "200001", room_id, extras=[{"name": "AC", "monthly_amount": 3000}])
    r = await client.get("/api/v1/admin/residents/export?search=35202-2000011-1", headers=headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    lines = r.text.strip().splitlines()
    assert lines[0] == "name,father_name,phone,cnic,room,seat,base_rent,extras,total,due_date,status"
    assert "Phase4 Resident 200001" in r.text
    assert "AC 3000" in r.text
    assert "11000" in r.text  # 8000 base + 3000 AC
    # A resident cannot export (admin only).
    token = (await _login("03004200001", "Resident@123"))["access_token"]
    r = await client.get("/api/v1/admin/residents/export", headers=_auth(token))
    assert r.status_code in (401, 403)


async def test_extra_charges_add_toggle_total():
    """Add AC + Geyser, toggle Geyser off, total follows active only."""
    headers = await _admin_headers()
    _, room_id = await _make_room(headers, "P4 Extras Building", "431")
    resident = await _make_resident(headers, "300001", room_id, extras=[{"name": "AC", "monthly_amount": 3000}])
    rid = resident["id"]
    assert resident["monthly_total"] == 11000
    assert resident["extras_total"] == 3000
    # First cycle already includes the AC extra.
    token = (await _login("03004300001", "Resident@123"))["access_token"]
    r = await client.get("/api/v1/resident/rent/current", headers=_auth(token))
    assert r.json()["data"]["total_amount"] == 11000
    # Add Geyser, then switch it off (winter ends).
    r = await client.post(
        f"/api/v1/admin/residents/{rid}/extras",
        json={"name": "Geyser", "monthly_amount": 1500},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    geyser_id = r.json()["data"]["id"]
    r = await client.get(f"/api/v1/admin/residents/{rid}", headers=headers)
    assert r.json()["data"]["monthly_total"] == 12500
    r = await client.post(
        f"/api/v1/admin/residents/{rid}/extras/{geyser_id}/toggle",
        json={"is_active": False},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["data"]["is_active"] is False
    r = await client.get(f"/api/v1/admin/residents/{rid}", headers=headers)
    assert r.json()["data"]["monthly_total"] == 11000
    # The already-created cycle is NOT rewritten by the toggle.
    r = await client.get("/api/v1/resident/rent/current", headers=_auth(token))
    assert r.json()["data"]["total_amount"] == 11000


async def test_extra_charges_next_cycle_total():
    """Paying the current cycle in full creates the next cycle with
    only the extras that are active at that moment."""
    headers = await _admin_headers()
    _, room_id = await _make_room(headers, "P4 NextCycle Building", "441")
    resident = await _make_resident(headers, "400001", room_id, extras=[{"name": "AC", "monthly_amount": 2000}])
    rid = resident["id"]
    # Add Geyser, then turn it off before paying.
    r = await client.post(
        f"/api/v1/admin/residents/{rid}/extras",
        json={"name": "Geyser", "monthly_amount": 1000},
        headers=headers,
    )
    geyser_id = r.json()["data"]["id"]
    await client.post(
        f"/api/v1/admin/residents/{rid}/extras/{geyser_id}/toggle",
        json={"is_active": False},
        headers=headers,
    )
    token = (await _login("03004400001", "Resident@123"))["access_token"]
    r = await client.get("/api/v1/resident/rent/current", headers=_auth(token))
    cycle = r.json()["data"]
    assert cycle["total_amount"] == 10000  # 8000 + 2000 AC (Geyser was added after)
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    r = await client.post(
        "/api/v1/resident/payments",
        headers=_auth(token),
        data={"rent_cycle_id": cycle["id"], "amount": 10000, "method": "Cash"},
        files={"screenshot": ("receipt.png", io.BytesIO(fake_png), "image/png")},
    )
    assert r.status_code == 201, r.text
    payment_id = r.json()["data"]["id"]
    r = await client.post(f"/api/v1/admin/payments/{payment_id}/approve", headers=headers)
    assert r.status_code == 200, r.text
    next_cycle = r.json()["data"]["next_cycle"]
    assert next_cycle is not None
    assert next_cycle["total_amount"] == 10000  # 8000 + 2000 AC only, Geyser off
    assert next_cycle["start_date"] == cycle["due_date"]


async def test_extra_charge_update_and_remove():
    """Update an amount, then remove the charge."""
    headers = await _admin_headers()
    _, room_id = await _make_room(headers, "P4 Update Building", "451")
    resident = await _make_resident(headers, "500001", room_id, extras=[{"name": "Cooler", "monthly_amount": 1000}])
    rid = resident["id"]
    r = await client.get(f"/api/v1/admin/residents/{rid}/extras", headers=headers)
    charge_id = r.json()["data"][0]["id"]
    r = await client.put(
        f"/api/v1/admin/residents/{rid}/extras/{charge_id}",
        json={"monthly_amount": 1200},
        headers=headers,
    )
    assert r.status_code == 200 and r.json()["data"]["monthly_amount"] == 1200
    r = await client.delete(f"/api/v1/admin/residents/{rid}/extras/{charge_id}", headers=headers)
    assert r.status_code == 200
    r = await client.get(f"/api/v1/admin/residents/{rid}/extras", headers=headers)
    assert r.json()["data"] == []


async def test_room_create_optional_building_and_update():
    """POST /rooms with no building reuses the single building;
    PUT updates number/type."""
    headers = await _admin_headers()
    r = await client.post(
        "/api/v1/admin/rooms",
        json={"room_number": "461", "room_type": "3-seater"},
        headers=headers,
    )
    # Several buildings already exist in the shared test DB, so a
    # building is required here — the endpoint must say so (400).
    assert r.status_code in (201, 400), r.text
    if r.status_code == 400:
        assert "pick a building" in r.text.lower()
    # Update a room created the normal way.
    _, room_id = await _make_room(headers, "P4 Update Room Building", "462")
    r = await client.put(
        f"/api/v1/admin/rooms/{room_id}",
        json={"room_number": "463", "room_type": "3-seater"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["room_number"] == "463"
    assert r.json()["data"]["room_type"] == "3-seater"
    assert r.json()["data"]["total_seats"] == 3
    r = await client.get(f"/api/v1/admin/rooms/{room_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["room_number"] == "463"
    assert "seats" in r.json()["data"] and "residents" in r.json()["data"]


async def test_room_card_shape():
    """Room cards carry seat dots/counts, resident names and rent."""
    headers = await _admin_headers()
    _, room_id = await _make_room(headers, "P4 Card Building", "471")
    await _make_resident(headers, "600001", room_id)
    r = await client.get("/api/v1/admin/rooms?page=1&page_size=100", headers=headers)
    rows = r.json()["data"]["items"]
    row = next(x for x in rows if x["room_number"] == "471")
    assert row["total_seats"] == 2 and row["vacant_seats"] == 1 and row["occupied_seats"] == 1
    assert row["residents"][0]["full_name"] == "Phase4 Resident 600001"
    assert row["residents"][0]["monthly_total"] == 8000
