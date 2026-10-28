"""Validación de JWT en business-service.

Demuestra que el servicio NO se limita a decodificar el token: verifica la firma RS256,
la expiración, el emisor, la audiencia y el rol, y rechaza los ataques más comunes.
"""

import base64
import hashlib
import hmac
import json
import time

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from tests.conftest import AUDIENCE, ISSUER, PRIVATE_KEY_PEM, PUBLIC_KEY_PEM, make_token

PROTECTED = "/api/clients"


def _b64(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


def _get(client: TestClient, token: str):
    return client.get(PROTECTED, headers={"Authorization": f"Bearer {token}"})


def test_accepts_valid_token(client: TestClient) -> None:
    assert _get(client, make_token()).status_code == 200


def test_rejects_missing_token(client: TestClient) -> None:
    response = client.get(PROTECTED)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_rejects_expired_token(client: TestClient) -> None:
    response = _get(client, make_token(expires_in=-10))
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "El token ha expirado"


def test_rejects_token_signed_with_another_private_key(client: TestClient) -> None:
    attacker_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = attacker_key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    assert _get(client, make_token(key=pem)).status_code == 401


def test_rejects_tampered_payload(client: TestClient) -> None:
    header, _, signature = make_token(role="OPERATOR").split(".")
    forged = _b64({"sub": "x", "role": "ADMIN", "iss": "motor-repair-auth", "aud": "motor-repair-api",
                   "iat": int(time.time()), "exp": int(time.time()) + 3600})
    assert _get(client, f"{header}.{forged}.{signature}").status_code == 401


def test_rejects_wrong_issuer_or_audience(client: TestClient) -> None:
    assert _get(client, make_token(issuer="otro-emisor")).status_code == 401
    assert _get(client, make_token(audience="otra-api")).status_code == 401


def test_rejects_unsigned_alg_none_token(client: TestClient) -> None:
    now = int(time.time())
    header = _b64({"alg": "none", "typ": "JWT"})
    payload = _b64({"sub": "x", "role": "ADMIN", "iss": "motor-repair-auth", "aud": "motor-repair-api",
                    "iat": now, "exp": now + 3600})
    assert _get(client, f"{header}.{payload}.").status_code == 401


def test_rejects_algorithm_confusion_hs256_with_public_key(client: TestClient) -> None:
    """Ataque clásico: firmar con HS256 usando la llave PÚBLICA (conocida) como secreto."""
    now = int(time.time())
    header = _b64({"alg": "HS256", "typ": "JWT"})
    payload = _b64({"sub": "x", "role": "ADMIN", "iss": "motor-repair-auth", "aud": "motor-repair-api",
                    "iat": now, "exp": now + 3600})
    signature = hmac.new(PUBLIC_KEY_PEM.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    token = f"{header}.{payload}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"
    assert _get(client, token).status_code == 401


def test_rejects_unknown_role(client: TestClient) -> None:
    assert _get(client, make_token(role="SUPERUSER")).status_code == 401


def test_rejects_token_without_expiration(client: TestClient) -> None:
    token = jwt.encode(
        {"sub": "x", "role": "ADMIN", "iss": ISSUER, "aud": AUDIENCE, "iat": int(time.time())},
        PRIVATE_KEY_PEM,
        algorithm="RS256",
    )
    assert _get(client, token).status_code == 401


def test_rejects_non_bearer_scheme(client: TestClient) -> None:
    response = client.get(PROTECTED, headers={"Authorization": f"Basic {make_token()}"})
    assert response.status_code == 401


def test_service_has_no_login_endpoint(client: TestClient) -> None:
    """La responsabilidad de autenticar es exclusiva de auth-service."""
    assert client.post("/api/auth/login", json={}).status_code == 404


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "up"
