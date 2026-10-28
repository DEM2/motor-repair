"""Configuración compartida de las pruebas.

- Genera un par de llaves RSA EFÍMERO. La llave PÚBLICA se entrega al servicio (como
  en producción) y la PRIVADA solo la usan las pruebas para fabricar tokens, simulando
  lo que haría auth-service.
- Usa una base de datos de pruebas (TEST_DATABASE_URL) que se recrea con las
  migraciones de Alembic al inicio de la sesión: así también se prueban las migraciones.
- Cada prueba empieza con las tablas vacías.
"""

import os
import time
import uuid
from collections.abc import Iterator
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# ── Variables de entorno: deben definirse ANTES de importar la aplicación ──────────
_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PRIVATE_KEY_PEM = _private_key.private_bytes(
    serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
).decode()
PUBLIC_KEY_PEM = (
    _private_key.public_key()
    .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    .decode()
)

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/business_test"
)
ISSUER = "motor-repair-auth"
AUDIENCE = "motor-repair-api"

os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": TEST_DATABASE_URL,
        "JWT_PUBLIC_KEY": PUBLIC_KEY_PEM,
        "JWT_ISSUER": ISSUER,
        "JWT_AUDIENCE": AUDIENCE,
    }
)
os.environ.pop("JWT_PUBLIC_KEY_PATH", None)

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db.session import get_db_engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    """Recrea el esquema desde cero ejecutando las migraciones de Alembic."""
    engine = get_db_engine()
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.attributes["configure_logger"] = False
    alembic_cfg.attributes["database_url"] = TEST_DATABASE_URL
    command.upgrade(alembic_cfg, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables() -> Iterator[None]:
    yield
    with get_db_engine().begin() as conn:
        conn.execute(
            text(
                "TRUNCATE repair_order_status_history, repair_orders, engines, clients "
                "RESTART IDENTITY CASCADE"
            )
        )
        conn.execute(text("ALTER SEQUENCE repair_order_number_seq RESTART WITH 1"))


# ── Tokens ──────────────────────────────────────────────────────────────────────────
def make_token(
    *,
    role: str = "OPERATOR",
    sub: str | None = None,
    email: str = "operador@taller.local",
    expires_in: int = 3600,
    key: Any = PRIVATE_KEY_PEM,
    algorithm: str = "RS256",
    issuer: str = ISSUER,
    audience: str = AUDIENCE,
    extra: dict[str, Any] | None = None,
) -> str:
    """Fabrica un token igual al que emite auth-service (permite variar cada claim)."""
    now = int(time.time())
    payload = {
        "sub": sub or str(uuid.uuid4()),
        "email": email,
        "name": "Operador de Prueba",
        "role": role,
        "iss": issuer,
        "aud": audience,
        "iat": now,
        "exp": now + expires_in,
        **(extra or {}),
    }
    return jwt.encode(payload, key, algorithm=algorithm)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def api(client: TestClient, auth_headers: dict[str, str]) -> "ApiHelper":
    return ApiHelper(client, auth_headers)


class ApiHelper:
    """Atajos para crear datos de prueba a través de la propia API."""

    def __init__(self, client: TestClient, headers: dict[str, str]) -> None:
        self.client = client
        self.headers = headers

    def request(self, method: str, url: str, **kwargs: Any):
        return self.client.request(method, url, headers=self.headers, **kwargs)

    def create_client(self, **overrides: Any) -> dict[str, Any]:
        payload = {
            "name": "Minera del Cesar S.A.S.",
            "identification_type": "NIT",
            "identification_number": f"900{uuid.uuid4().int % 10**6:06d}-1",
            "email": "mantenimiento@mineracesar.co",
            **overrides,
        }
        response = self.request("POST", "/api/clients", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    def create_engine(self, client_id: str | None = None, **overrides: Any) -> dict[str, Any]:
        payload = {
            "serial_number": f"CAT-{uuid.uuid4().hex[:8]}",
            "manufacturer": "Caterpillar",
            "model": "3516B",
            "engine_type": "Diésel V16",
            "power": "2000 HP",
            "client_id": client_id or self.create_client()["id"],
            **overrides,
        }
        response = self.request("POST", "/api/engines", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    def create_order(self, engine_id: str | None = None, **overrides: Any) -> dict[str, Any]:
        payload = {
            "engine_id": engine_id or self.create_engine()["id"],
            "reported_problem": "Pérdida de potencia y humo azul",
            "technician": "Carlos Pérez",
            "reception_date": "2026-01-10",
            "estimated_delivery_date": "2026-01-30",
            **overrides,
        }
        response = self.request("POST", "/api/repair-orders", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

