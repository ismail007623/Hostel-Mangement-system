"""Taqwa Boys Hostel backend — FastAPI entry point.

FastAPI + async SQLAlchemy + Pydantic v2. Every endpoint returns the
Xeven envelope ``{"succeed": bool, "status": int, "message": str,
"data": ...}``. Validation errors (422) are converted to the same
envelope. Real errors are logged only; the frontend never sees them.

All routes live in ``app/api/v1/router.py``; this file only creates
the app, adds CORS, and includes that one router.
"""

import os

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.database import engine, init_db
from app.core.logging_config import get_logger

logger = get_logger(__name__)
logger.info("Starting Taqwa Hostel FastAPI application")

# Create FastAPI app
app = FastAPI(title="Taqwa Boys Hostel API", version="1.1.0-phase2")

# Add CORS middleware — localhost frontend only for now.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded rent screenshots so the admin can view them when
# approving a payment (Phase 3). Files are only reachable by their
# unguessable stored name; no listing is exposed.
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Convert Pydantic 422 errors to the standard envelope.

    Field names are kept (so the frontend can highlight them) but no
    database or server internals are exposed.
    """
    logger.error(f"Validation failed: {exc.errors()}")
    return JSONResponse(
        content={
            "succeed": False,
            "status": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "message": "Invalid data, please check fields",
            "data": {"errors": [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()]},
        },
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


@app.on_event("startup")
async def on_startup() -> None:
    """Create tables on startup (SQLite dev / first run)."""
    await init_db()
    logger.info("Taqwa Hostel API started")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Dispose the async engine so its driver threads can exit cleanly."""
    await engine.dispose()
    logger.info("Taqwa Hostel API stopped")


# Root route
@app.get("/")
async def root():
    """Welcome route."""
    logger.info("Root endpoint '/' was called")
    return JSONResponse(content={"message": "Hi, Welcome to Taqwa Boys Hostel"})


@app.get("/health")
async def health():
    """Health check (no auth)."""
    return {"succeed": True, "status": 200, "message": "OK", "data": {"service": "taqwa-hostel-api", "phase": 2}}


# Include your API routes
logger.info("Including API router")
app.include_router(api_router, prefix="/api")

# Run the server
if __name__ == "__main__":
    logger.info("Running the app using Uvicorn")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
