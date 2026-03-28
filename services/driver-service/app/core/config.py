from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── PostgreSQL ───────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://conducteur:secret@localhost:5432/conducteurs_db"
    )

    # ── Keycloak / JWT ───────────────────────────────────────────────────────
    KEYCLOAK_URL: str = "http://keycloak:8080"
    KEYCLOAK_REALM: str = "fleet"
    KEYCLOAK_CLIENT_ID: str = "service-conducteurs"
    KEYCLOAK_CLIENT_SECRET: str = "changeme"

    # ── Kafka ────────────────────────────────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"
    KAFKA_TOPIC_CONDUCTEUR: str = "conducteur-events"

    # ── App ──────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "supersecretkey"

    @property
    def keycloak_jwks_uri(self) -> str:
        return (
            f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}"
            "/protocol/openid-connect/certs"
        )

    @property
    def keycloak_issuer(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}"


@lru_cache
def get_settings() -> Settings:
    return Settings()