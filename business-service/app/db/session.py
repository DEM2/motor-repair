"""Conexión a PostgreSQL con SQLAlchemy 2.0.

El servicio solo se conecta a su propia base de datos (business_db) con su propio
usuario (business_user), que no tiene permisos sobre la base de datos de auth-service.
"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Clase base de todos los modelos ORM."""


@lru_cache
def get_db_engine() -> Engine:
    # pool_pre_ping descarta conexiones caídas (por ejemplo, tras reiniciar PostgreSQL).
    return create_engine(get_settings().database_url, pool_pre_ping=True)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_db_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependencia de FastAPI: abre una sesión por petición y la cierra al terminar."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
