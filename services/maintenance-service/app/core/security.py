from typing import List

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

bearer_scheme = HTTPBearer()

_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache

    jwks_url = (
        f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}"
        "/protocol/openid-connect/certs"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        jwks = await _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=settings.KEYCLOAK_ALGORITHMS,
            audience=settings.KEYCLOAK_CLIENT_ID,
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalide : {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_roles(roles: List[str]):
    """Dependency factory – vérifie qu'au moins un rôle requis est présent."""

    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        realm_roles: list = (
            current_user.get("realm_access", {}).get("roles", [])
        )
        resource_roles: list = (
            current_user.get("resource_access", {})
            .get(settings.KEYCLOAK_CLIENT_ID, {})
            .get("roles", [])
        )
        all_roles = set(realm_roles + resource_roles)

        if not any(role in all_roles for role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rôle requis : {roles}",
            )
        return current_user

    return _check