import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from aiokafka import AIOKafkaProducer

from app.core.config import settings

logger = logging.getLogger(__name__)

TOPIC = "flotte.maintenances"


def _envelope(event_type: str, key: str, payload: dict[str, Any],
               correlation_id: str | None = None) -> dict[str, Any]:
    return {
        "eventId": str(uuid.uuid4()),
        "eventType": event_type,
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "service-maintenances",
        "correlationId": correlation_id,
        "payload": payload,
    }


class KafkaProducer:
    def __init__(self):
        self._producer: AIOKafkaProducer | None = None

    async def start(self):
        self._producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            client_id=settings.KAFKA_CLIENT_ID,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            enable_idempotence=True,
            acks="all",
            max_in_flight_requests_per_connection=5,
        )
        await self._producer.start()
        logger.info("Kafka producer started (topic=%s)", TOPIC)

    async def stop(self):
        if self._producer:
            await self._producer.stop()
            logger.info("Kafka producer stopped")

    async def send(self, event_type: str, key: str, payload: dict[str, Any],
                   correlation_id: str | None = None):
        """Send an event with the standard envelope to flotte.maintenances."""
        if not self._producer:
            logger.warning("Kafka producer not initialised – dropping event %s", event_type)
            return
        envelope = _envelope(event_type, key, payload, correlation_id)
        try:
            await self._producer.send_and_wait(topic=TOPIC, key=key, value=envelope)
            logger.debug("Kafka → [%s] key=%s", event_type, key)
        except Exception as exc:
            logger.error("Kafka send error [%s] key=%s: %s", event_type, key, exc, exc_info=True)

    # ── Semantic helpers ───────────────────────────────────────────────────

    async def emit_created(self, maintenance_id: str, vehicule_id: str, type_: str,
                            technicien_id: str | None, date_planifiee: str,
                            correlation_id: str | None = None):
        await self.send("maintenance.created", maintenance_id, {
            "maintenanceId": maintenance_id,
            "vehiculeId": vehicule_id,
            "type": type_,
            "technicienId": technicien_id,
            "datePlanifiee": date_planifiee,
        }, correlation_id)

    async def emit_started(self, maintenance_id: str, vehicule_id: str,
                            correlation_id: str | None = None):
        """Triggers vehicle-service saga: vehicle → EN_MAINTENANCE."""
        await self.send("maintenance.started", maintenance_id, {
            "maintenanceId": maintenance_id,
            "vehiculeId": vehicule_id,
        }, correlation_id)

    async def emit_completed(self, maintenance_id: str, vehicule_id: str,
                              correlation_id: str | None = None):
        """Triggers vehicle-service saga: vehicle → DISPONIBLE."""
        await self.send("maintenance.completed", maintenance_id, {
            "maintenanceId": maintenance_id,
            "vehiculeId": vehicule_id,
        }, correlation_id)

    async def emit_planned(self, maintenance_id: str, vehicule_id: str, type_: str,
                            date_planifiee: str, technicien_id: str | None,
                            correlation_id: str | None = None):
        """Published for the event-service notification handler."""
        await self.send("maintenance.planned", maintenance_id, {
            "maintenanceId": maintenance_id,
            "vehiculeId": vehicule_id,
            "type": type_.upper(),
            "datePlanifiee": date_planifiee,
            "technicienId": technicien_id,
        }, correlation_id)

    async def emit_statut_changed(self, maintenance_id: str, vehicule_id: str,
                                   nouveau_statut: str, correlation_id: str | None = None):
        await self.send("maintenance.statut_changed", maintenance_id, {
            "maintenanceId": maintenance_id,
            "vehiculeId": vehicule_id,
            "nouveauStatut": nouveau_statut,
        }, correlation_id)

    async def emit_deleted(self, maintenance_id: str, correlation_id: str | None = None):
        await self.send("maintenance.deleted", maintenance_id, {
            "maintenanceId": maintenance_id,
        }, correlation_id)


# Singleton shared by the lifespan
kafka_producer = KafkaProducer()


async def get_producer() -> KafkaProducer:
    return kafka_producer