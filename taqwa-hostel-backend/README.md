# Taqwa Boys Hostel — Backend (Phase 2)

FastAPI + SQLAlchemy + Pydantic v2 + PyJWT + bcrypt, managed with **uv**.

Phase 1: auth, admin dashboard, buildings / rooms / seats,
residents (manual + invite onboarding), settings, resident own-profile,
public hostel info and vacant seats.

Phase 2 (built): rent cycles (start + 30 days, grace from settings),
rent screenshot upload, payment approve / reject, due and paid lists,
rent history, edit-profile approval flow, Alembic migrations.

Phase 3 (built 2026-11-23): frontend in `../taqwa-hostel-frontend`
(Next.js + TypeScript + Tailwind) — landing page with live seats,
single login, admin portal, resident portal, PWA. Backend additions
for Phase 3 only: `GET /api/v1/public/seats/by-room` (per-room vacant
counts, no private data) and serving uploaded screenshots under
`/uploads` so the admin can view them when approving a payment.
Tests: 17 pass (`uv run pytest`).

## Phase 4 — UI-fixes round (built 2026-11-23)

Tests: 26 pass (`uv run pytest` — 17 old + 9 new in `tests/test_phase4.py`).

### Extra charges (new table `resident_extra_charges`, migration 0003)

An extra charge lives on the RESIDENT, not on the room: name
(presets AC / Cooler / Geyser + any custom name), monthly amount in
Rs typed in by the admin (no amount is hardcoded), `is_active`,
`start_date`, `end_date` (set when switched off), `created_at`.

**RULE: monthly total = base monthly_rent + sum of ACTIVE extras.
A change applies from the NEXT rent cycle only — it never changes
an already-created cycle's `total_amount`.** The first cycle is
created after the extras, so it already includes them; when a cycle
is fully paid, the next cycle (start = previous due date) totals the
base rent + the extras that are active at that moment. Geyser can
therefore be switched off when winter ends and the extra rent stops
from the next cycle.

Admin endpoints (all under `/api/v1/admin/residents/{id}/extras`,
admin auth only, Xeven envelope):
`GET` list · `POST` add · `PUT /{charge_id}` update ·
`POST /{charge_id}/toggle` `{"is_active": false}` ·
`DELETE /{charge_id}` remove. Extras can also be sent with the
manual resident add (`POST /api/v1/admin/residents`, `extras: [...]`)
and with application approve (`POST /api/v1/admin/applications/{id}/approve`,
`extras: [...]`). Person card, resident summary, due/paid lists and
the resident's own room all return `extras`, `extras_total` and
`monthly_total`; rent cycles return `base_amount` / `extras_amount`.

### Pagination, search, export

`GET /api/v1/admin/buildings`, `GET /api/v1/admin/buildings/{id}/rooms`,
`GET /api/v1/admin/rooms` and `GET /api/v1/admin/residents` accept
`?page=` (default 1) and `?page_size=` (default 20, max 100) and
return `{items, total, page, page_size, pages}`.
`GET /api/v1/admin/residents?search=` matches name, phone AND CNIC
(partial, case-insensitive).
`GET /api/v1/admin/residents/export?search=` (admin only) downloads
CSV: name, father_name, phone, cnic, room, seat, base_rent, extras,
total, due_date, status — same search filter as the list.

### Rooms

`POST /api/v1/admin/rooms` creates a room with an OPTIONAL building:
blank + exactly one building → that building; blank + no building →
a "Main Building" is auto-created and used; blank + several buildings
→ 400, pick one. `PUT /api/v1/admin/rooms/{id}` edits number / type /
portion (no floor field exists): growing adds vacant seats, shrinking
removes only vacant seats and fails when an occupied seat would go.
`GET /api/v1/admin/rooms/{id}` returns the room card + seats + each
resident's extras. Room cards carry seat counts, resident names and
each resident's monthly total.

## Requirements — uv only

Install uv once (if not installed):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv --version
```

`pyproject.toml` + `uv.lock` are the source of truth.
`requirements.txt` is generated from them (`uv export --no-hashes -o requirements.txt`)
for compatibility only — do not edit it by hand.

## Run (English)

```bash
uv sync
cp .env.example .env
# Edit .env: set JWT_SECRET_KEY — generate with: openssl rand -hex 32
# Never commit .env (it is in .gitignore).
uv run python -m app.seed_admin
uv run uvicorn main:app --reload
```

Open http://127.0.0.1:8000/health — it returns `{"succeed": true, ...}`.

Test login (seed admin Qari Abdul Majeed, phone 03004493800,
default dev password Taqwa@123 — change it after first login):

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "03004493800", "password": "Taqwa@123"}'
```

Copy the `access_token` from the reply and use it as
`Authorization: Bearer <token>` for admin calls.

Run tests:

```bash
uv run pytest tests/ -q
```

Migrations (Postgres or SQLite):

```bash
uv run alembic upgrade head
```

## Chalana (Roman Urdu)

```bash
uv sync
cp .env.example .env
# .env me JWT_SECRET_KEY set karo: openssl rand -hex 32 se banao
# .env ko kabhi GitHub pe mat bhejo
uv run python -m app.seed_admin
uv run uvicorn main:app --reload
```

Seed se Qari Sahib ka admin account ban jata hai (phone 03004493800).
Pehli dafa login karke password change kar lena.

## Phase 2 examples

Pay rent (resident, multipart form with screenshot):

```bash
curl -X POST http://127.0.0.1:8000/api/v1/resident/payments \
  -H "Authorization: Bearer <resident-token>" \
  -F "rent_cycle_id=1" -F "amount=8000" -F "method=JazzCash" \
  -F "screenshot=@receipt.png;type=image/png"
```

Approve a payment (admin):

```bash
curl -X POST http://127.0.0.1:8000/api/v1/admin/payments/1/approve \
  -H "Authorization: Bearer <admin-token>"
```

Due list with wa.me reminder links (admin):

```bash
curl "http://127.0.0.1:8000/api/v1/admin/rent/due-list?status=overdue" \
  -H "Authorization: Bearer <admin-token>"
```

Resident rent history and current cycle:

```bash
curl http://127.0.0.1:8000/api/v1/resident/rent-history \
  -H "Authorization: Bearer <resident-token>"
curl http://127.0.0.1:8000/api/v1/resident/rent/current \
  -H "Authorization: Bearer <resident-token>"
```

Edit-profile request (resident). Guardian-only changes apply at once;
name / phone / CNIC changes need admin approval:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/resident/profile/edit-request \
  -H "Authorization: Bearer <resident-token>" \
  -H "Content-Type: application/json" \
  -d '{"guardian_phone": "03009998888"}'
```

## Rules

- Har endpoint Xeven envelope deta hai:
  `{"succeed": true/false, "status": 200, "message": "...", "data": ...}`
- Asli error (database / Python) frontend ko kabhi nahi dikhta,
  sirf backend ke log me jata hai.
- Role client se nahi aata, database se aata hai. Public signup se
  koi admin nahi ban sakta.
- Phone aur CNIC unique hain, naam unique nahi hai.
- Rent: due date = start date + 30 din. Grace days Qari setting se.
  A fully-paid cycle creates the next cycle from the old due date,
  not from the payment date.
- No OTP, no WhatsApp API in POC. Login phone + password se hai.
  Reminders are wa.me links only.
- Screenshots: png / jpg / jpeg only, max 5MB, stored under
  `uploads/payments/` (gitignored).
