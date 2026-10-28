import uuid

from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models.client import Client
from app.repositories.client_repository import ClientRepository
from app.schemas.client import ClientCreate, ClientUpdate
from app.schemas.common import PageParams


class ClientService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = ClientRepository(session)

    def get(self, client_id: uuid.UUID) -> Client:
        client = self.repo.get(client_id)
        if client is None:
            raise NotFoundError("Cliente no encontrado")
        return client

    def list(
        self, *, search: str | None, is_active: bool | None, params: PageParams
    ) -> tuple[list[Client], int]:
        return self.repo.list(search=search, is_active=is_active, offset=params.offset, limit=params.size)

    def create(self, data: ClientCreate) -> Client:
        self._ensure_identification_available(data.identification_number)
        client = self.repo.add(Client(**data.model_dump()))
        self.session.commit()
        return client

    def update(self, client_id: uuid.UUID, data: ClientUpdate) -> Client:
        client = self.get(client_id)
        changes = data.model_dump(exclude_unset=True)

        new_number = changes.get("identification_number")
        if new_number and new_number != client.identification_number:
            self._ensure_identification_available(new_number)

        for field, value in changes.items():
            setattr(client, field, value)
        self.session.commit()
        self.session.refresh(client)
        return client

    def _ensure_identification_available(self, number: str) -> None:
        """Regla: no puede haber dos clientes con el mismo número de identificación."""
        if self.repo.get_by_identification_number(number) is not None:
            raise ConflictError(f"Ya existe un cliente con el número de identificación {number}")
