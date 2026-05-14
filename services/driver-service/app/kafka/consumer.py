"""
Kafka consumer for the driver-service.
Subscribes to flotte.missions to update driver status on mission lifecycle events.
"""
import json
import logging

from aiokafka import AIOKafkaConsumer

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Idempotency: we track processed eventIds in-memory within the process.
# In production, use Redis or a DB table for cross-restart deduplication.
_processed_event_ids: set[str] = set()
_MAX_IDEMPOTENCY_CACHE = 10_000


async def run_consumer():
    """
    Consume mission events and react to:
      - mission.created   → driver status → en_mission
      - mission.started   → driver status → en_mission
      - mission.completed → driver status → actif
      - mission.cancelled → driver status → actif
    """
    consumer = AIOKafkaConsumer(
        "flotte.missions",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=settings.KAFKA_GROUP_ID,
        client_id=f"service-drivers-consumer",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        key_deserializer=lambda k: k.decode("utf-8") if k else None,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )

    await consumer.start()
    logger.info("Driver Kafka consumer started, listening to flotte.missions")

    try:
        async for msg in consumer:
            try:
                envelope = msg.value
                event_id = envelope.get("eventId") or envelope.get("event_id")
                event_type = envelope.get("eventType") or envelope.get("event_type")
                payload = envelope.get("payload", {})

                # Idempotency check
                if event_id and event_id in _processed_event_ids:
                    logger.debug("Duplicate event %s – skipping", event_id)
                    await consumer.commit()
                    continue

                logger.info("Mission event: type=%s id=%s", event_type, event_id)

                if event_type == "mission.created":
                    await _handle_mission_created(payload)
                elif event_type == "mission.started":
                    await _handle_mission_started(payload)
                elif event_type == "mission.completed":
                    await _handle_mission_completed(payload)
                elif event_type == "mission.cancelled":
                    await _handle_mission_cancelled(payload)

                # Record as processed
                if event_id:
                    _processed_event_ids.add(event_id)
                    if len(_processed_event_ids) > _MAX_IDEMPOTENCY_CACHE:
                        # Trim oldest entries (approximate FIFO)
                        old = next(iter(_processed_event_ids))
                        _processed_event_ids.discard(old)

                await consumer.commit()

            except Exception as exc:
                logger.error(
                    "Error processing mission event partition=%d offset=%d: %s",
                    msg.partition, msg.offset, exc, exc_info=True,
                )
                # Do not commit → replay on restart (at-least-once)

    finally:
        await consumer.stop()
        logger.info("Driver Kafka consumer stopped")


async def _handle_mission_created(payload: dict):
    """Mark driver as on mission when mission is created."""
    conductor_id = payload.get("conducteurId") or payload.get("conducteur_id")
    mission_id = payload.get("missionId") or payload.get("mission_id")

    if not conductor_id:
        logger.warning("mission.created event missing conducteurId, skipping")
        return

    logger.info("Driver %s created mission %s — updating status", conductor_id, mission_id)
    await _update_driver_statut(conductor_id, "en_mission")


async def _handle_mission_started(payload: dict):
    """Mark driver as actively on mission."""
    conductor_id = payload.get("conducteurId") or payload.get("conducteur_id")
    mission_id = payload.get("missionId") or payload.get("mission_id")

    if not conductor_id:
        logger.warning("mission.started event missing conducteurId, skipping")
        return

    logger.info("Driver %s started mission %s — updating status", conductor_id, mission_id)
    await _update_driver_statut(conductor_id, "en_mission")


async def _handle_mission_completed(payload: dict):
    """Return driver to available status after mission."""
    conductor_id = payload.get("conducteurId") or payload.get("conducteur_id")
    mission_id = payload.get("missionId") or payload.get("mission_id")

    if not conductor_id:
        logger.warning("mission.completed event missing conducteurId, skipping")
        return

    logger.info("Driver %s completed mission %s — restoring status", conductor_id, mission_id)
    await _update_driver_statut(conductor_id, "actif")


async def _handle_mission_cancelled(payload: dict):
    """Restore driver status when mission is cancelled."""
    conductor_id = payload.get("conducteurId") or payload.get("conducteur_id")
    if conductor_id:
        await _update_driver_statut(conductor_id, "actif")


async def _update_driver_statut(driver_id: str, new_statut: str):
    """Update driver statut via repository, using a fresh DB session."""
    try:
        import uuid as _uuid
        from app.db.session import AsyncSessionLocal
        from app.models.driver import StatutDriver
        from app.repositories.driver_repository import DriverRepository

        statut_enum = StatutDriver(new_statut)
        async with AsyncSessionLocal() as session:
            repo = DriverRepository(session)
            await repo.update_statut(_uuid.UUID(driver_id), statut_enum)
            await session.commit()
            logger.info("Driver %s status → %s", driver_id, new_statut)
    except Exception as exc:
        logger.error("Failed to update driver %s status: %s", driver_id, exc, exc_info=True)
        raise
