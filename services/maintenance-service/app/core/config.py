from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── PostgreSQL ───────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:secret@postgres-maintenance:5432/maintenance_db"
    )

    # ── Debug ────────────────────────────────────────────────────────────────
    DEBUG: bool = True

    # ── Keycloak / JWT ───────────────────────────────────────────────────────
    KEYCLOAK_URL: str = "http://keycloak:8080"
    KEYCLOAK_REALM: str = "flotte-management"
    KEYCLOAK_REALM_URL: str | None = None
    KEYCLOAK_CLIENT_ID: str = "flotte-services"
    KEYCLOAK_CLIENT_SECRET: str = "changeme"
    KEYCLOAK_ALGORITHMS: list[str] = ["RS256"]
    KEYCLOAK_VERIFY_ISSUER: bool = False
    JWT_PUBLIC_KEY: str | None = None

    # ── Kafka ────────────────────────────────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"
    KAFKA_CLIENT_ID: str = "service-maintenances"
    KAFKA_TOPIC_MAINTENANCE: str = "maintenance-events"

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "maintenance-service"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    APP_SECRET_KEY: str = "supersecretkey"

    @property
    def keycloak_jwks_uri(self) -> str:
        return f"{self.keycloak_issuer}/protocol/openid-connect/certs"

    @property
    def keycloak_issuer(self) -> str:
        if self.KEYCLOAK_REALM_URL:
            return self.KEYCLOAK_REALM_URL.rstrip("/")
        return f"{self.KEYCLOAK_URL.rstrip('/')}/realms/{self.KEYCLOAK_REALM}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()