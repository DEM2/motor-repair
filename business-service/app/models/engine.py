"""Motor de maquinaria de minería pesada que ingresa al taller."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func, true
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.client import Client


class Engine(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "engines"

    # UNIQUE: impide motores duplicados por código interno / número de serie.
    serial_number: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    # Campos abiertos de texto, tal como lo pide el requerimiento.
    manufacturer: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    engine_type: Mapped[str] = mapped_column(String(100), nullable=False)
    power: Mapped[str] = mapped_column(String(60), nullable=False)

    # RESTRICT: no se puede borrar un cliente que tenga motores asociados.
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())

    client: Mapped[Client] = relationship(back_populates="engines", lazy="joined")
