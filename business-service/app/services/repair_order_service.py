"""Reglas de negocio de las órdenes de reparación.

Flujo de estados permitido (máquina de estados):

    RECEIVED ─► IN_DIAGNOSIS ─► AWAITING_APPROVAL ─► IN_REPAIR ─► IN_TESTING ─► COMPLETED ─► DELIVERED
                                                         ▲             │
                                                         └─────────────┘  (si las pruebas fallan)

Reglas adicionales:
  - Solo se crean órdenes para motores activos de clientes activos.
  - Un motor no puede tener dos órdenes abiertas (no entregadas) al mismo tiempo.
  - Para pasar a AWAITING_APPROVAL debe existir un diagnóstico técnico.
  - Para pasar a COMPLETED debe registrarse el trabajo realizado.
  - Al pasar a DELIVERED se registra la fecha real de entrega.
  - Cada cambio de estado queda en el historial con el usuario (del JWT) y una nota opcional.
"""

import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, NotFoundError
from app.core.security import CurrentUser
from app.models.repair_order import RepairOrder, RepairOrderStatusHistory, RepairStatus
from app.repositories.repair_order_repository import RepairOrderRepository
from app.schemas.common import PageParams
from app.schemas.repair_order import RepairOrderCreate, RepairOrderStatusUpdate
from app.services.engine_service import EngineService

ALLOWED_TRANSITIONS: dict[RepairStatus, frozenset[RepairStatus]] = {
    RepairStatus.RECEIVED: frozenset({RepairStatus.IN_DIAGNOSIS}),
    RepairStatus.IN_DIAGNOSIS: frozenset({RepairStatus.AWAITING_APPROVAL}),
    RepairStatus.AWAITING_APPROVAL: frozenset({RepairStatus.IN_REPAIR}),
    RepairStatus.IN_REPAIR: frozenset({RepairStatus.IN_TESTING}),
    RepairStatus.IN_TESTING: frozenset({RepairStatus.COMPLETED, RepairStatus.IN_REPAIR}),
    RepairStatus.COMPLETED: frozenset({RepairStatus.DELIVERED}),
    RepairStatus.DELIVERED: frozenset(),
}


def allowed_next_statuses(current: RepairStatus) -> list[RepairStatus]:
    """Estados siguientes válidos, en el orden en que aparecen en el flujo."""
    return [status for status in RepairStatus if status in ALLOWED_TRANSITIONS[current]]


class RepairOrderService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = RepairOrderRepository(session)
        self.engines = EngineService(session)

    def get(self, order_id: uuid.UUID) -> RepairOrder:
        order = self.repo.get(order_id, with_history=True)
        if order is None:
            raise NotFoundError("Orden de reparación no encontrada")
        return order

    def list(
        self,
        *,
        search: str | None,
        status: RepairStatus | None,
        client_id: uuid.UUID | None,
        engine_id: uuid.UUID | None,
        params: PageParams,
    ) -> tuple[list[RepairOrder], int]:
        return self.repo.list(
            search=search,
            status=status,
            client_id=client_id,
            engine_id=engine_id,
            offset=params.offset,
            limit=params.size,
        )

    def summary(self) -> tuple[int, dict[RepairStatus, int]]:
        counts = self.repo.count_by_status()
        by_status = {status: counts.get(status, 0) for status in RepairStatus}
        return sum(by_status.values()), by_status

    def create(self, data: RepairOrderCreate, user: CurrentUser) -> RepairOrder:
        engine = self.engines.get(data.engine_id)
        if not engine.is_active:
            raise BusinessRuleError("No se puede crear una orden para un motor inactivo")
        if not engine.client.is_active:
            raise BusinessRuleError("No se puede crear una orden para un motor de un cliente inactivo")
        if self.repo.has_open_order_for_engine(engine.id):
            raise BusinessRuleError("El motor ya tiene una orden de reparación abierta")

        order = RepairOrder(
            **data.model_dump(),
            order_number=self._next_order_number(data.reception_date),
            client_id=engine.client_id,
            status=RepairStatus.RECEIVED,
            created_by_user_id=user.id,
            created_by_email=user.email,
        )
        order.status_history.append(
            RepairOrderStatusHistory(
                from_status=None,
                to_status=RepairStatus.RECEIVED,
                note="Orden creada",
                changed_by_user_id=user.id,
                changed_by_email=user.email,
            )
        )
        self.repo.add(order)
        self.session.commit()
        return self.get(order.id)

    def change_status(
        self, order_id: uuid.UUID, data: RepairOrderStatusUpdate, user: CurrentUser
    ) -> RepairOrder:
        order = self.get(order_id)
        current, target = order.status, data.status

        if target not in ALLOWED_TRANSITIONS[current]:
            allowed = ", ".join(allowed_next_statuses(current)) or "ninguno (estado final)"
            raise BusinessRuleError(
                f"Transición no permitida: {current} → {target}. Estados permitidos: {allowed}",
                details={"current": current, "requested": target, "allowed": allowed_next_statuses(current)},
            )

        if data.diagnosis is not None:
            order.diagnosis = data.diagnosis
        if data.work_performed is not None:
            order.work_performed = data.work_performed

        if target == RepairStatus.AWAITING_APPROVAL and not order.diagnosis:
            raise BusinessRuleError("Debe registrar el diagnóstico técnico antes de solicitar aprobación")
        if target == RepairStatus.COMPLETED and not order.work_performed:
            raise BusinessRuleError("Debe registrar el trabajo realizado antes de finalizar la orden")

        if target == RepairStatus.DELIVERED:
            delivery_date = data.actual_delivery_date or date.today()
            if delivery_date < order.reception_date:
                raise BusinessRuleError("La fecha de entrega no puede ser anterior a la fecha de recepción")
            order.actual_delivery_date = delivery_date
        elif data.actual_delivery_date is not None:
            raise BusinessRuleError("La fecha real de entrega solo se registra al pasar a DELIVERED")

        order.status = target
        order.status_history.append(
            RepairOrderStatusHistory(
                from_status=current,
                to_status=target,
                note=data.note,
                changed_by_user_id=user.id,
                changed_by_email=user.email,
            )
        )
        self.session.commit()
        self.session.expire(order)
        return self.get(order.id)

    def _next_order_number(self, reception_date: date) -> str:
        return f"OT-{reception_date.year}-{self.repo.next_order_sequence():06d}"
