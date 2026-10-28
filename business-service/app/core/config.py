"""Configuración del servicio a partir de variables de entorno.

- Se valida con Pydantic al arrancar: si falta una variable obligatoria o la llave
  pública no es válida, el servicio no inicia ("fail fast").
- Este servicio SOLO recibe la llave PÚBLICA RSA. Con ella puede verificar los JWT
  emitidos por auth-service, pero nunca puede emitirlos.
"""

from functools import cached_property, lru_cache
from pathlib import Path
from typing import Literal

from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str

    jwt_public_key: str | None = None
    jwt_public_key_path: str | None = None
    jwt_issuer: str = "motor-repair-auth"
    jwt_audience: str = "motor-repair-api"

    cors_origins: str = "http://localhost:5173"

    @model_validator(mode="after")
    def _validate_public_key(self) -> "Settings":
        # Acceder a la propiedad fuerza la carga y validación de la llave al arrancar.
        _ = self.public_key_pem
        return self

    @cached_property
    def public_key_pem(self) -> str:
        """PEM de la llave pública, desde la variable o desde el archivo configurado."""
        if self.jwt_public_key:
            pem = self.jwt_public_key.replace("\\n", "\n")
        elif self.jwt_public_key_path:
            pem = Path(self.jwt_public_key_path).read_text(encoding="utf-8")
        else:
            raise ValueError("Debe definir JWT_PUBLIC_KEY o JWT_PUBLIC_KEY_PATH para validar los tokens.")

        key = load_pem_public_key(pem.encode())
        if not isinstance(key, RSAPublicKey):
            raise ValueError("La llave pública debe ser RSA (algoritmo RS256).")
        return pem

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Instancia única de la configuración (se puede reemplazar en pruebas)."""
    return Settings()  # type: ignore[call-arg]
