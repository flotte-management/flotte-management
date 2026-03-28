"""
Producteur Kafka asynchrone.

Événements émis () :
  conducteur.created
  conducteur.updated
  conducteur.statut_changed
  conducteur.deleted
  conducteur.permis_added
  conducteur.assigned
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

async def _emit(event_type: str, payload: dict[str, Any]) -> None:
    if _producer is None:
        logger.debug("Kafka désactivé – événement ignoré : %s", event_type)
        return
    envelope = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "service-conducteurs",
        "payload": payload,
    }
    try:
        await _producer.send_and_wait(
            settings.KAFKA_TOPIC_CONDUCTEUR,
            value=envelope,
            key=str(payload.get("conducteur_id", "")).encode(),
        )
        logger.debug("Événement émis : %s", event_type)
    except Exception as exc:
        # On logue sans lever pour ne pas bloquer la réponse HTTP
        logger.error("Erreur émission Kafka %s : %s", event_type, exc)


# ── API publique ──────────────────────────────────────────────────────────────

async def emit_conducteur_created(conducteur_id: str, data: dict[str, Any]) -> None:
    await _emit("conducteur.created", {"conducteur_id": conducteur_id, **data})


async def emit_conducteur_updated(conducteur_id: str, changes: dict[str, Any]) -> None:
    await _emit("conducteur.updated", {"conducteur_id": conducteur_id, "changes": changes})


async def emit_conducteur_statut_changed(
    conducteur_id: str, old_statut: str, new_statut: str
) -> None:
    await _emit(
        "conducteur.statut_changed",
        {
            "conducteur_id": conducteur_id,
            "old_statut": old_statut,
            "new_statut": new_statut,
        },
    )


async def emit_conducteur_deleted(conducteur_id: str) -> None:
    await _emit("conducteur.deleted", {"conducteur_id": conducteur_id})


async def emit_permis_added(conducteur_id: str, permis_id: str, categorie: str) -> None:
    await _emit(
        "conducteur.permis_added",
        {
            "conducteur_id": conducteur_id,
            "permis_id": permis_id,
            "categorie": categorie,
        },
    )


async def emit_conducteur_assigned(
    conducteur_id: str, vehicule_id: str, assignation_id: str
) -> None:
    await _emit(
        "conducteur.assigned",
        {
            "conducteur_id": conducteur_id,
            "vehicule_id": vehicule_id,
            "assignation_id": assignation_id,
        },
    )