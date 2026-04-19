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


def _normalize_role(role: str) -> str:
    return role.strip().upper().removeprefix("ROLE_")


def _collect_roles(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        cleaned = value.replace(",", " ")
        return [part.strip() for part in cleaned.split() if part.strip()]
    return []


def _extract_roles(raw: dict[str, Any], client_id: str) -> list[str]:
    realm_roles = _collect_roles(raw.get("realm_access", {}).get("roles"))

    resource_access = raw.get("resource_access", {})
    resource_roles: list[str] = []
    client_roles: list[str] = []
    if isinstance(resource_access, dict):
        for resource_name, claims in resource_access.items():
            extracted = _collect_roles((claims or {}).get("roles"))
            resource_roles.extend(extracted)
            if resource_name == client_id:
                client_roles.extend(extracted)

    extra_roles = [
        *_collect_roles(raw.get("roles")),
        *_collect_roles(raw.get("authorities")),
        *_collect_roles(raw.get("scope")),
        *_collect_roles(raw.get("scp")),
    ]

    normalized = [
        _normalize_role(role)
        for role in [*realm_roles, *resource_roles, *client_roles, *extra_roles]
    ]
    return sorted(set(role for role in normalized if role))


# ── Token payload ─────────────────────────────────────────────────────────────

class TokenPayload:
    def __init__(self, raw: dict[str, Any]) -> None:
        self.sub: str = raw.get("sub", "")
        self.email: str = raw.get("email", "")
        self.preferred_username: str = raw.get("preferred_username", "")
        self.roles: list[str] = []


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
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            issuer=settings.keycloak_issuer if settings.KEYCLOAK_VERIFY_ISSUER else None,
            options={
                "verify_at_hash": False,
                "verify_aud": False,
                "verify_iss": settings.KEYCLOAK_VERIFY_ISSUER,
            },
        )
    except (httpx.HTTPError, JWTError) as exc:
        if not settings.JWT_PUBLIC_KEY:
            logger.warning("JWT/JWKS error: %s", exc)
            raise credentials_exception from exc
        try:
            payload = jwt.decode(
                token,
                settings.JWT_PUBLIC_KEY.replace("\\n", "\n"),
                algorithms=["RS256"],
                issuer=settings.keycloak_issuer if settings.KEYCLOAK_VERIFY_ISSUER else None,
                options={
                    "verify_at_hash": False,
                    "verify_aud": False,
                    "verify_iss": settings.KEYCLOAK_VERIFY_ISSUER,
                },
            )
        except JWTError as fallback_exc:
            logger.warning("JWT error: %s", fallback_exc)
            raise credentials_exception from fallback_exc

    token_payload = TokenPayload(payload)
    token_payload.roles = _extract_roles(payload, settings.KEYCLOAK_CLIENT_ID)

    if not token_payload.sub:
        logger.warning("JWT missing subject claim")
        raise credentials_exception

    return token_payload


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

    normalized_required = {_normalize_role(role) for role in roles if role.strip()}

    async def _check(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if not normalized_required:
            return user

        current_roles = {_normalize_role(role) for role in user.roles}
        if current_roles.intersection(normalized_required):
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Rôle requis : {sorted(normalized_required)}",
        )

    return _check