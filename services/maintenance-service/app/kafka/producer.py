import json
import logging
from typing import Any

from aiokafka import AIOKafkaProducer
from fastapi import Request

from app.core.config import settings

logger = logging.getLogger(__name__)


class KafkaProducer:
    def __init__(self):
        self._producer: AIOKafkaProducer | None = None

    async def start(self):
        self._producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            client_id=settings.KAFKA_CLIENT_ID,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
        )
        await self._producer.start()
        logger.info("Kafka producer démarré.")

    async def stop(self):
        if self._producer:
            await self._producer.stop()
            logger.info("Kafka producer arrêté.")

    async def send(self, topic: str, key: str, value: dict[str, Any]):
        if not self._producer:
            logger.warning("Kafka producer non initialisé – message ignoré.")
            return
        try:
            await self._producer.send_and_wait(topic=topic, key=key, value=value)
            logger.debug("Kafka → topic=%s key=%s", topic, key)
        except Exception as exc:
            logger.error("Erreur Kafka send: %s", exc, exc_info=True)


# Singleton partagé par le lifespan
kafka_producer = KafkaProducer()


async def get_producer() -> KafkaProducer:
    return kafka_producer