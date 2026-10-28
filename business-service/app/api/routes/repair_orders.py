"""Endpoints de órdenes de reparación.

No existe un endpoint para editar libremente una orden (el requerimiento no lo pide);
la orden evoluciona únicamente a través de cambios de estado, que quedan auditados.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.repair_order import RepairOrder, RepairStatus
from app.schemas.common import Page, PageParams, page_params
from app.schemas.repair_order import (
    RepairOrderCreate,
    RepairOrderListItem,
    RepairOrderRead,
    RepairOrderStatusUpdate,
    RepairOrderSummary,
)
from app.services.repair_order_service import RepairOrderService, allowed_next_statuses

router = APIRouter(prefix="/repair-orders", tags=["Órdenes de reparación"])


def _to_detail(order: RepairOrder) -> RepairOrderRead:
    detail = RepairOrderRead.model_validate(order)
    detail.allowed_next_statuses = allowed_next_statuses(order.status)
    return detail


@router.get("", response_model=Page[RepairOrderListItem], summary="Listar y buscar órdenes")
def list_repair_orders(
    q: str | None = Query(None, description="Busca por número, técnico, problema, serie del motor o cliente"),
    status_filter: RepairStatus | None = Query(None, alias="status", description="Filtra por estado"),
    client_id: uuid.UUID | None = Query(None, description="Filtra por cliente"),
    engine_id: uuid.UUID | None = Query(None, description="Filtra por motor"),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> Page[RepairOrderListItem]:
    items, total = RepairOrderService(db).list(
        search=q, status=status_filter, client_id=client_id, engine_id=engine_id, params=params
    )
    return Page[RepairOrderListItem].build([RepairOrderListItem.model_validate(o) for o in items], total, params)


@router.get("/summary", response_model=RepairOrderSummary, summary="Conteo de órdenes por estado")
def repair_orders_summary(
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> RepairOrderSummary:
    total, by_status = RepairOrderService(db).summary()
    return RepairOrderSummary(total=total, by_status=by_status)


@router.post(
    "",
    response_model=RepairOrderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una orden de reparación",
    responses={
        404: {"description": "Motor no encontrado"},
        409: {"description": "Motor/cliente inactivo o motor con una orden abierta"},
    },
)
def create_repair_order(
    data: RepairOrderCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> RepairOrderRead:
    return _to_detail(RepairOrderService(db).create(data, user))


@router.get("/{order_id}", response_model=RepairOrderRead, summary="Consultar el detalle e historial")
def get_repair_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> RepairOrderRead:
    return _to_detail(RepairOrderService(db).get(order_id))


@router.patch(
    "/{order_id}/status",
    response_model=RepairOrderRead,
    summary="Cambiar el estado de una orden",
    responses={
        404: {"description": "Orden no encontrada"},
        409: {"description": "Transición no permitida o falta información requerida"},
    },
)
def change_repair_order_status(
    order_id: uuid.UUID,
    data: RepairOrderStatusUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> RepairOrderRead:
    return _to_detail(RepairOrderService(db).change_status(order_id, data, user))
