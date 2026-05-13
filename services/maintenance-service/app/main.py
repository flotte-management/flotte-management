import asyncio
import importlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import init_db
from app.kafka.producer import kafka_producer


logger = logging.getLogger(__name__)


def _load_run_consumer():
    try:
        module = importlib.import_module("app.kafka.consumer")
        return getattr(module, "run_consumer", None)
    except ImportError:
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────
    await init_db()

    run_consumer = _load_run_consumer()
    consumer_task = None
    try:
        await kafka_producer.start()
    except Exception as exc:
        logger.warning("Kafka indisponible au démarrage: %s", exc)

    if run_consumer is not None:
        consumer_task = asyncio.create_task(run_consumer())

    yield
    # ── Shutdown ─────────────────────────────────
    if consumer_task is not None:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass
    await kafka_producer.stop()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Service de gestion des maintenances véhicules",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
