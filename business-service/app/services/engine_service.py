import uuid

from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models.engine import Engine
from app.repositories.engine_repository import EngineRepository
from app.schemas.common import PageParams
from app.schemas.engine import EngineCreate, EngineUpdate
from app.services.client_service import ClientService


class EngineService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = EngineRepository(session)
        self.clients = ClientService(session)

    def get(self, engine_id: uuid.UUID) -> Engine:
        engine = self.repo.get(engine_id)
        if engine is None:
            raise NotFoundError("Motor no encontrado")
        return engine

    def list(
        self,
        *,
        search: str | None,
        client_id: uuid.UUID | None,
        is_active: bool | None,
        params: PageParams,
    ) -> tuple[list[Engine], int]:
        return self.repo.list(
            search=search, client_id=client_id, is_active=is_active, offset=params.offset, limit=params.size
        )

    def create(self, data: EngineCreate) -> Engine:
        self._ensure_serial_available(data.serial_number)
        self._ensure_active_owner(data.client_id)
        engine = self.repo.add(Engine(**data.model_dump()))
        self.session.commit()
        self.session.refresh(engine)
        return engine

    def update(self, engine_id: uuid.UUID, data: EngineUpdate) -> Engine:
        engine = self.get(engine_id)
        changes = data.model_dump(exclude_unset=True)

        new_serial = changes.get("serial_number")
        if new_serial and new_serial != engine.serial_number:
            self._ensure_serial_available(new_serial)

        new_owner = changes.get("client_id")
        if new_owner and new_owner != engine.client_id:
            self._ensure_active_owner(new_owner)

        for field, value in changes.items():
            setattr(engine, field, value)
        self.session.commit()
        self.session.refresh(engine)
        return engine

    def _ensure_serial_available(self, serial_number: str) -> None:
        """Regla: el código interno / número de serie es único."""
        if self.repo.get_by_serial_number(serial_number) is not None:
            raise ConflictError(f"Ya existe un motor con el número de serie {serial_number}")

    def _ensure_active_owner(self, client_id: uuid.UUID) -> None:
        """Regla: un motor solo puede pertenecer a un cliente existente y activo."""
        client = self.clients.get(client_id)
        if not client.is_active:
            raise BusinessRuleError("No se puede asignar un motor a un cliente inactivo")
