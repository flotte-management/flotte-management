"""
Validation JWT émis par Keycloak + helpers RBAC.

Flow :
  1. L'API Gateway (ou le client) passe un Bearer token dans Authorization.
  2. On récupère les JWKS depuis Keycloak (mis en cache), on vérifie la
     signature, l'issuer et l'audience.
  3. Les rôles sont lus dans realm_access.roles  (ou resource_access.<client>.roles).
  4. Les dépendances FastAPI exposent get_current_user() et require_roles().
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Cache JWKS en mémoire (simple dict) ; pour la prod préférer TTL via cachetools
_jwks_cache: dict[str, Any] = {}

bearer_scheme = HTTPBearer(auto_error=True)


# ── JWKS ─────────────────────────────────────────────────────────────────────

async def _fetch_jwks(settings: Settings) -> dict[str, Any]:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        resp = await client.get(settings.keycloak_jwks_uri, timeout=5.0)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache


# ── Token payload ─────────────────────────────────────────────────────────────

class TokenPayload:
    def __init__(self, raw: dict[str, Any]) -> None:
        self.sub: str = raw.get("sub", "")
        self.email: str = raw.get("email", "")
        self.preferred_username: str = raw.get("preferred_username", "")
        # Rôles realm
        self.roles: list[str] = (
            raw.get("realm_access", {}).get("roles", [])
        )


# ── Dépendance principale ─────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> TokenPayload:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        jwks = await _fetch_jwks(settings)
        # jose cherche la bonne clé via le header `kid`
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.KEYCLOAK_CLIENT_ID,
            issuer=settings.keycloak_issuer,
            options={"verify_at_hash": False},
        )
        return TokenPayload(payload)
    except JWTError as exc:
        logger.warning("JWT error: %s", exc)
        raise credentials_exception from exc


# ── RBAC helper ───────────────────────────────────────────────────────────────

def require_roles(*roles: str):
    """
    Dépendance FastAPI qui lève 403 si l'utilisateur n'a aucun des rôles.

    Usage :
        @router.delete(
            "/{id}",
            dependencies=[Depends(require_roles("admin", "fleet-manager"))],
        )
    """

    async def _check(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if not any(r in user.roles for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle requis : {list(roles)}",
            )
        return user

    return _check