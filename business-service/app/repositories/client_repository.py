import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.client import Client


class ClientRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, client_id: uuid.UUID) -> Client | None:
        return self.session.get(Client, client_id)

    def get_by_identification_number(self, number: str) -> Client | None:
        return self.session.scalar(select(Client).where(Client.identification_number == number))

    def list(
        self, *, search: str | None, is_active: bool | None, offset: int, limit: int
    ) -> tuple[list[Client], int]:
        query = select(Client)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Client.name.ilike(pattern),
                    Client.identification_number.ilike(pattern),
                    Client.email.ilike(pattern),
                )
            )
        if is_active is not None:
            query = query.where(Client.is_active == is_active)

        total = self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = self.session.scalars(query.order_by(Client.name).offset(offset).limit(limit)).all()
        return list(items), total

    def add(self, client: Client) -> Client:
        self.session.add(client)
        self.session.flush()
        return client
