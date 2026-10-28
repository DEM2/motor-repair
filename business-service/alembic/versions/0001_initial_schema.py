"""Esquema inicial: clientes, motores, órdenes de reparación e historial de estados.

Revision ID: 0001
Revises:
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

REPAIR_STATUSES = (
    "RECEIVED",
    "IN_DIAGNOSIS",
    "AWAITING_APPROVAL",
    "IN_REPAIR",
    "IN_TESTING",
    "COMPLETED",
    "DELIVERED",
)


def upgrade() -> None:
    identification_type = postgresql.ENUM("NIT", "CC", "CE", "PASSPORT", name="identification_type")
    repair_status = postgresql.ENUM(*REPAIR_STATUSES, name="repair_status")
    identification_type.create(op.get_bind())
    repair_status.create(op.get_bind())

    op.create_table(
        "clients",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column(
            "identification_type",
            postgresql.ENUM(name="identification_type", create_type=False),
            nullable=False,
        ),
        sa.Column("identification_number", sa.String(30), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("identification_number", name="uq_clients_identification_number"),
    )

    op.create_table(
        "engines",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("serial_number", sa.String(60), nullable=False),
        sa.Column("manufacturer", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("engine_type", sa.String(100), nullable=False),
        sa.Column("power", sa.String(60), nullable=False),
        sa.Column(
            "client_id",
            sa.UUID(),
            sa.ForeignKey("clients.id", name="fk_engines_client_id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("serial_number", name="uq_engines_serial_number"),
    )
    op.create_index("ix_engines_client_id", "engines", ["client_id"])

    # Secuencia para los números de orden legibles (OT-AAAA-000001).
    op.execute("CREATE SEQUENCE repair_order_number_seq START 1")

    op.create_table(
        "repair_orders",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("order_number", sa.String(20), nullable=False),
        sa.Column(
            "engine_id",
            sa.UUID(),
            sa.ForeignKey("engines.id", name="fk_repair_orders_engine_id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            sa.UUID(),
            sa.ForeignKey("clients.id", name="fk_repair_orders_client_id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("reception_date", sa.Date(), nullable=False),
        sa.Column("reported_problem", sa.Text(), nullable=False),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("work_performed", sa.Text(), nullable=True),
        sa.Column("technician", sa.String(120), nullable=False),
        sa.Column("estimated_delivery_date", sa.Date(), nullable=False),
        sa.Column("actual_delivery_date", sa.Date(), nullable=True),
        sa.Column("status", postgresql.ENUM(name="repair_status", create_type=False), nullable=False),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.String(64), nullable=False),
        sa.Column("created_by_email", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("order_number", name="uq_repair_orders_order_number"),
        # Reglas de integridad también en la base de datos (defensa en profundidad).
        sa.CheckConstraint(
            "estimated_delivery_date >= reception_date", name="ck_repair_orders_estimated_after_reception"
        ),
        sa.CheckConstraint(
            "actual_delivery_date IS NULL OR actual_delivery_date >= reception_date",
            name="ck_repair_orders_delivery_after_reception",
        ),
    )
    op.create_index("ix_repair_orders_engine_id", "repair_orders", ["engine_id"])
    op.create_index("ix_repair_orders_client_id", "repair_orders", ["client_id"])
    op.create_index("ix_repair_orders_status", "repair_orders", ["status"])
    # Garantiza a nivel de BD que un motor tenga como máximo UNA orden abierta (no entregada).
    op.create_index(
        "uq_repair_orders_one_open_per_engine",
        "repair_orders",
        ["engine_id"],
        unique=True,
        postgresql_where=sa.text("status <> 'DELIVERED'"),
    )

    op.create_table(
        "repair_order_status_history",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "repair_order_id",
            sa.UUID(),
            sa.ForeignKey(
                "repair_orders.id", name="fk_status_history_repair_order_id", ondelete="CASCADE"
            ),
            nullable=False,
        ),
        sa.Column("from_status", postgresql.ENUM(name="repair_status", create_type=False), nullable=True),
        sa.Column("to_status", postgresql.ENUM(name="repair_status", create_type=False), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by_user_id", sa.String(64), nullable=False),
        sa.Column("changed_by_email", sa.String(255), nullable=False),
        sa.Column(
            "changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.clock_timestamp()
        ),
    )
    op.create_index(
        "ix_repair_order_status_history_repair_order_id", "repair_order_status_history", ["repair_order_id"]
    )


def downgrade() -> None:
    op.drop_table("repair_order_status_history")
    op.drop_table("repair_orders")
    op.execute("DROP SEQUENCE IF EXISTS repair_order_number_seq")
    op.drop_table("engines")
    op.drop_table("clients")
    postgresql.ENUM(name="repair_status").drop(op.get_bind())
    postgresql.ENUM(name="identification_type").drop(op.get_bind())
