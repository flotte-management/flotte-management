"""
Point d'entrée FastAPI.
Lifespan : démarrage/arrêt du producteur et consommateur Kafka.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, generate_latest
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.kafka.producer import start_producer, stop_producer
from app.kafka.consumer import run_consumer
from app.metrics import set_drivers_active
from app.models.driver import StatutDriver
from app.repositories.driver_repository import DriverRepository

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    await start_producer()
    consumer_task = asyncio.create_task(run_consumer())
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
    await stop_producer()


app = FastAPI(
    title="Service Drivers",
    description=(
        "Microservice de gestion des drivers, permis et assignations "
        "de la flotte automobile."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.APP_ENV == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Metrics instrumentation ───────────────────────────────────────────────────
instrumentator = Instrumentator().instrument(app)
# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "service-drivers"}


@app.get("/metrics")
async def metrics():
    async with AsyncSessionLocal() as session:
        repo = DriverRepository(session)
        active_count = await repo.count_by_statut(StatutDriver.actif)
        set_drivers_active(active_count)
    return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
