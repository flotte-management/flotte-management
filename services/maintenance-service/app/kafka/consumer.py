"""
Kafka consumer for the maintenance-service.
Loaded dynamically by app/main.py via importlib.
"""
import json
import logging

from aiokafka import AIOKafkaConsumer

from app.core.config import settings

logger = logging.getLogger(__name__)


async def run_consumer():
    """
    Consumes events from flotte.vehicules.
    Currently used to react to vehicle status changes if needed
    (e.g., cancelling maintenance when vehicle is HORS_SERVICE).
    """
    consumer = AIOKafkaConsumer(
        "flotte.vehicules",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=settings.KAFKA_GROUP_ID,
        client_id=f"{settings.KAFKA_CLIENT_ID}-consumer",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        key_deserializer=lambda k: k.decode("utf-8") if k else None,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )

    await consumer.start()
    logger.info("Maintenance Kafka consumer started, listening to flotte.vehicules")

    try:
        async for msg in consumer:
            try:
                envelope = msg.value
                event_type = envelope.get("eventType")
                payload = envelope.get("payload", {})

                if event_type == "vehicule.deleted":
                    vehicule_id = payload.get("vehiculeId")
                    logger.info(
                        "Vehicle %s deleted — any active maintenances should be cancelled",
                        vehicule_id,
                    )
                    # TODO: call maintenance repository to cancel active maintenances for vehicule_id

                await consumer.commit()

            except Exception as exc:
                logger.error(
                    "Error processing vehicle event partition=%d offset=%d: %s",
                    msg.partition, msg.offset, exc, exc_info=True,
                )
                # Don't commit → message replays on restart (at-least-once)

    finally:
        await consumer.stop()
        logger.info("Maintenance Kafka consumer stopped")
