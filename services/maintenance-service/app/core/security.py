import logging
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=True)

_jwks_cache: dict[str, Any] = {}


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        resp = await client.get(settings.keycloak_jwks_uri, timeout=5)
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


def _extract_roles(payload: dict[str, Any]) -> list[str]:
    realm_roles = _collect_roles(payload.get("realm_access", {}).get("roles"))

    resource_access = payload.get("resource_access", {})
    resource_roles: list[str] = []
    if isinstance(resource_access, dict):
        for claims in resource_access.values():
            resource_roles.extend(_collect_roles((claims or {}).get("roles")))

    extra_roles = [
        *_collect_roles(payload.get("roles")),
        *_collect_roles(payload.get("authorities")),
        *_collect_roles(payload.get("scope")),
        *_collect_roles(payload.get("scp")),
    ]

    normalized = [
        _normalize_role(role)
        for role in [*realm_roles, *resource_roles, *extra_roles]
    ]
    return sorted(set(role for role in normalized if role))


class TokenPayload:
    def __init__(self, raw: dict[str, Any]) -> None:
        self.sub: str = raw.get("sub", "")
        self.email: str = raw.get("email", "")
        self.preferred_username: str = raw.get("preferred_username", "")
        self.roles: list[str] = _extract_roles(raw)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> TokenPayload:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expire",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        jwks = await _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=settings.KEYCLOAK_ALGORITHMS,
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
                algorithms=settings.KEYCLOAK_ALGORITHMS,
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
    if not token_payload.sub:
        logger.warning("JWT missing subject claim")
        raise credentials_exception

    return token_payload


def require_roles(*roles: str):
    """Dependency factory - verifies that at least one required role is present."""

    normalized_required = {_normalize_role(role) for role in roles if role.strip()}

    async def _check(current_user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if not normalized_required:
            return current_user

        current_roles = {_normalize_role(role) for role in current_user.roles}
        if current_roles.intersection(normalized_required):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role requis : {sorted(normalized_required)}",
        )

    return _check