"""Modelos ORM. Se importan aquí para que Alembic y SQLAlchemy los registren."""

from app.models.client import Client, IdentificationType
from app.models.engine import Engine
from app.models.repair_order import RepairOrder, RepairOrderStatusHistory, RepairStatus

__all__ = [
    "Client",
    "Engine",
    "IdentificationType",
    "RepairOrder",
    "RepairOrderStatusHistory",
    "RepairStatus",
]
