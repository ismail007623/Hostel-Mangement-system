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
