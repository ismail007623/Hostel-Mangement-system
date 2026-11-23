# Alembic (migrations)

Phase 1 used `Base.metadata.create_all()` on startup, which is still
kept as a safety net for local SQLite development.

Phase 2 adds real Alembic migrations. The database URL comes from
`DATABASE_URL` in `.env` (see `alembic/env.py`), never from this folder.

```bash
# Apply all migrations (Postgres or SQLite):
uv run alembic upgrade head

# Check status:
uv run alembic current

# Roll back one step:
uv run alembic downgrade -1
```

Migrations:
- `0001_baseline` — creates all tables from `Base.metadata`.
- `0002_phase2` — `profile_edit_requests` table, plus
  `payments.reviewed_by`, `payments.screenshot_path` and
  `residents.guardian_name` (each step checks first, so it is safe
  on a Phase 1 database made by `create_all`).
