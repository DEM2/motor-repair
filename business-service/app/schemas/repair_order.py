"""Esquemas de órdenes de reparación."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.models.repair_order import RepairStatus
from app.schemas.client import ClientSummary
from app.schemas.common import ORMModel
from app.schemas.engine import EngineSummary

LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=5000)]
TechnicianName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]


class RepairOrderCreate(BaseModel):
    """Datos para crear una orden. El cliente se toma del propietario actual del motor."""

    engine_id: uuid.UUID
    reception_date: date = Field(default_factory=date.today)
    reported_problem: LongText = Field(examples=["Pérdida de potencia y humo azul al arrancar"])
    diagnosis: LongText | None = None
    work_performed: LongText | None = None
    technician: TechnicianName = Field(examples=["Carlos Pérez"])
    estimated_delivery_date: date
    observations: LongText | None = None

    @model_validator(mode="after")
    def _check_dates(self) -> "RepairOrderCreate":
        if self.reception_date > date.today():
            raise ValueError("La fecha de recepción no puede estar en el futuro")
        if self.estimated_delivery_date < self.reception_date:
            raise ValueError("La fecha estimada de entrega no puede ser anterior a la fecha de recepción")
        return self


class RepairOrderStatusUpdate(BaseModel):
    """Cambio de estado. Puede registrar el diagnóstico o el trabajo realizado en el mismo paso."""

    status: RepairStatus
    note: LongText | None = Field(default=None, description="Comentario que queda en el historial")
    diagnosis: LongText | None = None
    work_performed: LongText | None = None
    actual_delivery_date: date | None = Field(
        default=None, description="Solo al pasar a DELIVERED. Si se omite, se usa la fecha actual."
    )


class StatusHistoryRead(ORMModel):
    id: uuid.UUID
    from_status: RepairStatus | None
    to_status: RepairStatus
    note: str | None
    changed_by_user_id: str
    changed_by_email: str
    changed_at: datetime


class RepairOrderListItem(ORMModel):
    id: uuid.UUID
    order_number: str
    status: RepairStatus
    reception_date: date
    estimated_delivery_date: date
    actual_delivery_date: date | None
    technician: str
    engine: EngineSummary
    client: ClientSummary
    created_at: datetime
    updated_at: datetime


class RepairOrderRead(RepairOrderListItem):
    engine_id: uuid.UUID
    client_id: uuid.UUID
    reported_problem: str
    diagnosis: str | None
    work_performed: str | None
    observations: str | None
    created_by_user_id: str
    created_by_email: str
    allowed_next_statuses: list[RepairStatus] = Field(
        default_factory=list, description="Estados a los que la orden puede pasar desde el actual"
    )
    status_history: list[StatusHistoryRead]


class RepairOrderSummary(BaseModel):
    """Conteo de órdenes por estado, para el dashboard."""

    total: int
    by_status: dict[RepairStatus, int]
