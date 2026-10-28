"""Órdenes de reparación y su historial de estados."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.client import Client
from app.models.engine import Engine
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class RepairStatus(StrEnum):
    """Estados del proceso de reparación (en el orden natural del flujo)."""

    RECEIVED = "RECEIVED"  # Recibido
    IN_DIAGNOSIS = "IN_DIAGNOSIS"  # En diagnóstico
    AWAITING_APPROVAL = "AWAITING_APPROVAL"  # Esperando aprobación
    IN_REPAIR = "IN_REPAIR"  # En reparación
    IN_TESTING = "IN_TESTING"  # En pruebas
    COMPLETED = "COMPLETED"  # Finalizado
    DELIVERED = "DELIVERED"  # Entregado


repair_status_enum = Enum(RepairStatus, name="repair_status")


class RepairOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "repair_orders"
    __table_args__ = (
        # Reglas de integridad también en la base de datos (defensa en profundidad).
        CheckConstraint(
            "estimated_delivery_date >= reception_date", name="ck_repair_orders_estimated_after_reception"
        ),
        CheckConstraint(
            "actual_delivery_date IS NULL OR actual_delivery_date >= reception_date",
            name="ck_repair_orders_delivery_after_reception",
        ),
        # Un motor puede tener como máximo UNA orden abierta (no entregada).
        Index(
            "uq_repair_orders_one_open_per_engine",
            "engine_id",
            unique=True,
            postgresql_where=text("status <> 'DELIVERED'"),
        ),
    )

    # Número legible y único, por ejemplo "OT-2026-000001" (generado desde una secuencia).
    order_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)

    engine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("engines.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Cliente propietario del motor AL MOMENTO de recibirlo. Se guarda en la orden para
    # conservar el historial aunque el motor cambie de propietario después.
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    reception_date: Mapped[date] = mapped_column(Date, nullable=False)
    reported_problem: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text)
    work_performed: Mapped[str | None] = mapped_column(Text)
    # Técnico responsable: dato de referencia en texto (no es un usuario del sistema).
    technician: Mapped[str] = mapped_column(String(120), nullable=False)
    estimated_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[RepairStatus] = mapped_column(
        repair_status_enum, nullable=False, default=RepairStatus.RECEIVED, index=True
    )
    observations: Mapped[str | None] = mapped_column(Text)

    # Trazabilidad: quién creó la orden (id y correo tomados del JWT, sin FK a otra BD).
    created_by_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by_email: Mapped[str] = mapped_column(String(255), nullable=False)

    engine: Mapped[Engine] = relationship(lazy="joined")
    client: Mapped[Client] = relationship(lazy="joined")
    status_history: Mapped[list[RepairOrderStatusHistory]] = relationship(
        back_populates="repair_order",
        order_by="RepairOrderStatusHistory.changed_at",
        cascade="all, delete-orphan",
    )


class RepairOrderStatusHistory(UUIDPrimaryKeyMixin, Base):
    """Cada cambio de estado de una orden queda registrado aquí (auditoría)."""

    __tablename__ = "repair_order_status_history"

    repair_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nulo en el primer registro (creación de la orden).
    from_status: Mapped[RepairStatus | None] = mapped_column(repair_status_enum)
    to_status: Mapped[RepairStatus] = mapped_column(repair_status_enum, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    changed_by_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    changed_by_email: Mapped[str] = mapped_column(String(255), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )

    repair_order: Mapped[RepairOrder] = relationship(back_populates="status_history")
