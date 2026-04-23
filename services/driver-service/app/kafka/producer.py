"""
Producteur Kafka asynchrone.

Événements émis () :
  driver.created
  driver.updated
  driver.statut_changed
  driver.deleted
  driver.permis_added
  driver.assigned
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_producer: AIOKafkaProducer | None = None


# ── Lifecycle ─────────────────────────────────────────────────────────────────

async def start_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        acks="all",
        enable_idempotence=True,
        max_batch_size=16384,
        linger_ms=5,
    )
    try:
        await _producer.start()
        logger.info("Kafka producer démarré (%s)", settings.KAFKA_BOOTSTRAP_SERVERS)
    except KafkaConnectionError as exc:
        logger.warning("Kafka indisponible au démarrage : %s", exc)
        _producer = None


async def stop_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
        logger.info("Kafka producer arrêté")


# ── Helper interne ────────────────────────────────────────────────────────────

async def _emit(event_type: str, payload: dict[str, Any], key: str | None = None) -> None:
    if _producer is None:
        logger.debug("Kafka désactivé – événement ignoré : %s", event_type)
        return
    envelope = {
        "eventId": str(uuid.uuid4()),
        "eventType": event_type,
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "service-drivers",
        "correlationId": None,
        "payload": payload,
    }
    msg_key = (key or str(payload.get("driver_id", ""))).encode()
    try:
        await _producer.send_and_wait(
            settings.KAFKA_TOPIC_DRIVER,
            value=envelope,
            key=msg_key,
        )
        logger.debug("Événement émis : %s", event_type)
    except Exception as exc:
        # Non-blocking — log and continue
        logger.error("Erreur émission Kafka %s : %s", event_type, exc)


# ── API publique ──────────────────────────────────────────────────────────────

async def emit_driver_created(driver_id: str, data: dict[str, Any]) -> None:
    await _emit("driver.created", {"driver_id": driver_id, **data})


async def emit_driver_updated(driver_id: str, changes: dict[str, Any]) -> None:
    await _emit("driver.updated", {"driver_id": driver_id, "changes": changes})


async def emit_driver_statut_changed(
    driver_id: str, old_statut: str, new_statut: str
) -> None:
    await _emit(
        "driver.statut_changed",
        {
            "driver_id": driver_id,
            "old_statut": old_statut,
            "new_statut": new_statut,
        },
    )


async def emit_driver_deleted(driver_id: str) -> None:
    await _emit("driver.deleted", {"driver_id": driver_id})


async def emit_permis_added(driver_id: str, permis_id: str, categorie: str) -> None:
    await _emit(
        "driver.permis_added",
        {
            "driver_id": driver_id,
            "permis_id": permis_id,
            "categorie": categorie,
        },
    )


async def emit_driver_assigned(
    driver_id: str, vehicule_id: str, assignation_id: str
) -> None:
    await _emit(
        "driver.assigned",
        {
            "driver_id": driver_id,
            "vehicule_id": vehicule_id,
            "assignation_id": assignation_id,
        },
    )