import uuid

from sqlalchemy import Sequence, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.client import Client
from app.models.engine import Engine
from app.models.repair_order import RepairOrder, RepairStatus

# Secuencia de PostgreSQL usada para generar números de orden consecutivos sin colisiones,
# incluso con peticiones concurrentes (la crea la migración inicial).
order_number_sequence = Sequence("repair_order_number_seq")


class RepairOrderRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def next_order_sequence(self) -> int:
        return int(self.session.execute(order_number_sequence.next_value()).scalar_one())

    def get(self, order_id: uuid.UUID, *, with_history: bool = False) -> RepairOrder | None:
        query = select(RepairOrder).where(RepairOrder.id == order_id)
        if with_history:
            query = query.options(selectinload(RepairOrder.status_history))
        return self.session.scalar(query)

    def has_open_order_for_engine(self, engine_id: uuid.UUID) -> bool:
        """Una orden está "abierta" mientras el motor no haya sido entregado al cliente."""
        query = select(RepairOrder.id).where(
            RepairOrder.engine_id == engine_id, RepairOrder.status != RepairStatus.DELIVERED
        )
        return self.session.scalar(query.limit(1)) is not None

    def list(
        self,
        *,
        search: str | None,
        status: RepairStatus | None,
        client_id: uuid.UUID | None,
        engine_id: uuid.UUID | None,
        offset: int,
        limit: int,
    ) -> tuple[list[RepairOrder], int]:
        query = select(RepairOrder).join(RepairOrder.engine).join(RepairOrder.client)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    RepairOrder.order_number.ilike(pattern),
                    RepairOrder.technician.ilike(pattern),
                    RepairOrder.reported_problem.ilike(pattern),
                    Engine.serial_number.ilike(pattern),
                    Client.name.ilike(pattern),
                )
            )
        if status is not None:
            query = query.where(RepairOrder.status == status)
        if client_id is not None:
            query = query.where(RepairOrder.client_id == client_id)
        if engine_id is not None:
            query = query.where(RepairOrder.engine_id == engine_id)

        total = self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = self.session.scalars(
            query.order_by(RepairOrder.created_at.desc(), RepairOrder.order_number.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return list(items), total

    def count_by_status(self) -> dict[RepairStatus, int]:
        rows = self.session.execute(
            select(RepairOrder.status, func.count()).group_by(RepairOrder.status)
        ).all()
        return {status: count for status, count in rows}

    def add(self, order: RepairOrder) -> RepairOrder:
        self.session.add(order)
        self.session.flush()
        return order
