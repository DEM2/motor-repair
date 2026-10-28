import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.engine import Engine


class EngineRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, engine_id: uuid.UUID) -> Engine | None:
        return self.session.get(Engine, engine_id)

    def get_by_serial_number(self, serial_number: str) -> Engine | None:
        return self.session.scalar(select(Engine).where(Engine.serial_number == serial_number))

    def list(
        self,
        *,
        search: str | None,
        client_id: uuid.UUID | None,
        is_active: bool | None,
        offset: int,
        limit: int,
    ) -> tuple[list[Engine], int]:
        query = select(Engine)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Engine.serial_number.ilike(pattern),
                    Engine.manufacturer.ilike(pattern),
                    Engine.model.ilike(pattern),
                    Engine.engine_type.ilike(pattern),
                )
            )
        if client_id is not None:
            query = query.where(Engine.client_id == client_id)
        if is_active is not None:
            query = query.where(Engine.is_active == is_active)

        total = self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = self.session.scalars(
            query.order_by(Engine.registered_at.desc()).offset(offset).limit(limit)
        ).all()
        return list(items), total

    def add(self, engine: Engine) -> Engine:
        self.session.add(engine)
        self.session.flush()
        return engine
