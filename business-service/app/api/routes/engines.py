"""Endpoints de motores."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.schemas.common import Page, PageParams, page_params
from app.schemas.engine import EngineCreate, EngineRead, EngineUpdate
from app.services.engine_service import EngineService

router = APIRouter(prefix="/engines", tags=["Motores"])


@router.get("", response_model=Page[EngineRead], summary="Listar motores")
def list_engines(
    q: str | None = Query(None, description="Busca por serie, fabricante, modelo o tipo"),
    client_id: uuid.UUID | None = Query(None, description="Filtra por cliente propietario"),
    is_active: bool | None = Query(None, description="Filtra por estado activo/inactivo"),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> Page[EngineRead]:
    items, total = EngineService(db).list(search=q, client_id=client_id, is_active=is_active, params=params)
    return Page[EngineRead].build([EngineRead.model_validate(e) for e in items], total, params)


@router.post(
    "",
    response_model=EngineRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un motor",
    responses={
        404: {"description": "Cliente no encontrado"},
        409: {"description": "Número de serie duplicado o cliente inactivo"},
    },
)
def create_engine(
    data: EngineCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> EngineRead:
    return EngineRead.model_validate(EngineService(db).create(data))


@router.get("/{engine_id}", response_model=EngineRead, summary="Consultar un motor")
def get_engine(
    engine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> EngineRead:
    return EngineRead.model_validate(EngineService(db).get(engine_id))


@router.patch(
    "/{engine_id}",
    response_model=EngineRead,
    summary="Actualizar un motor (incluye activar/desactivar)",
    responses={404: {"description": "No encontrado"}, 409: {"description": "Serie duplicada"}},
)
def update_engine(
    engine_id: uuid.UUID,
    data: EngineUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> EngineRead:
    return EngineRead.model_validate(EngineService(db).update(engine_id, data))
