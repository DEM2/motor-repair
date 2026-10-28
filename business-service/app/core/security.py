"""Validación de los JWT emitidos por auth-service.

Este servicio NO tiene login ni almacena contraseñas. Confía únicamente en tokens:
  1. Firmados con RS256 por la llave privada de auth-service (se verifican con la pública).
  2. No expirados (claim `exp`).
  3. Emitidos por el emisor esperado (`iss`) y dirigidos a esta API (`aud`).
  4. Con identidad (`sub`) y un rol conocido (`role`).

No basta con decodificar el token: `jwt.decode` con la llave pública VERIFICA la firma
criptográficamente. Fijar `algorithms=["RS256"]` evita el ataque de confusión de
algoritmo (por ejemplo, un token con alg "none" o "HS256").
"""

from enum import StrEnum

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import ForbiddenError, UnauthorizedError


class Role(StrEnum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"


class CurrentUser(BaseModel):
    """Identidad del usuario extraída de un token válido."""

    id: str
    email: str
    name: str
    role: Role


# auto_error=False para responder con nuestro propio formato de error (401 en vez de 403).
bearer_scheme = HTTPBearer(auto_error=False, description="JWT emitido por auth-service (POST /api/auth/login)")


def decode_access_token(token: str, settings: Settings) -> CurrentUser:
    try:
        payload = jwt.decode(
            token,
            key=settings.public_key_pem,
            algorithms=["RS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("El token ha expirado") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Token inválido") from exc

    role = payload.get("role")
    if role not in Role.__members__:
        raise UnauthorizedError("Token inválido: rol desconocido")

    return CurrentUser(
        id=str(payload["sub"]),
        email=str(payload.get("email", "")),
        name=str(payload.get("name", "")),
        role=Role(role),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    """Dependencia de FastAPI: protege un endpoint exigiendo un JWT válido."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Falta el token de acceso (Authorization: Bearer <token>)")
    return decode_access_token(credentials.credentials, settings)


def require_roles(*roles: Role):
    """Dependencia que además exige uno de los roles indicados."""

    def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise ForbiddenError("No tiene permisos para realizar esta acción")
        return user

    return checker
