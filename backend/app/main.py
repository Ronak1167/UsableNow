from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.api.routes import router as api_router
from app.seed.seed_data import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed demo data if database is empty
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db, force_reset=False)
    finally:
        db.close()
    yield
    # Shutdown logic (if any)


app = FastAPI(
    title="UsableNow API",
    description=(
        "Open Doesn't Mean Usable. Need-aware facility usability platform for JIIT campus and hostel residents. "
        "Built for Lumina '26 — Hack the Unseen by team 404 Brain Not Found (Pragya Ahlawat, Paras, Ronak Jain)."
    ),
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Middleware
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root_info():
    return {
        "name": "UsableNow API",
        "tagline": "Open Doesn't Mean Usable — Know before you go.",
        "hackathon": "Lumina '26 — Hack the Unseen",
        "team": "404 Brain Not Found (Pragya Ahlawat, Paras, Ronak Jain)",
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health",
        "transparency_rule": "UNKNOWN DOES NOT MEAN UNAVAILABLE."
    }
