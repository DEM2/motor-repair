"""Cliente: empresa o persona propietaria de los motores."""

from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, String, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.engine import Engine


class IdentificationType(StrEnum):
    NIT = "NIT"  # Número de Identificación Tributaria (empresas)
    CC = "CC"  # Cédula de ciudadanía
    CE = "CE"  # Cédula de extranjería
    PASSPORT = "PASSPORT"


class Client(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "clients"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    identification_type: Mapped[IdentificationType] = mapped_column(
        Enum(IdentificationType, name="identification_type"), nullable=False
    )
    # UNIQUE: impide clientes duplicados por número de identificación.
    identification_number: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())

    engines: Mapped[list[Engine]] = relationship(back_populates="client")
