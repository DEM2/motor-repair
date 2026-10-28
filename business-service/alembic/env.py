"""Entorno de ejecución de Alembic.

Usa la misma DATABASE_URL que la aplicación y los metadatos de los modelos ORM,
lo que permite autogenerar migraciones con:

    alembic revision --autogenerate -m "descripcion"
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app import models  # noqa: F401  (registra todos los modelos en Base.metadata)
from app.core.config import get_settings
from app.db.session import Base

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    # Permite que las pruebas indiquen otra URL; por defecto usa la configuración del servicio.
    return config.attributes.get("database_url") or get_settings().database_url


def run_migrations_offline() -> None:
    """Genera el SQL sin conectarse (alembic upgrade head --sql)."""
    context.configure(url=get_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(get_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
