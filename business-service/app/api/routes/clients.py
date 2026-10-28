"""Endpoints de clientes. Las rutas solo traducen HTTP ⇄ servicio; no tienen lógica de negocio."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate
from app.schemas.common import Page, PageParams, page_params
from app.services.client_service import ClientService

router = APIRouter(prefix="/clients", tags=["Clientes"])


@router.get("", response_model=Page[ClientRead], summary="Listar clientes")
def list_clients(
    q: str | None = Query(None, description="Busca por nombre, identificación o correo"),
    is_active: bool | None = Query(None, description="Filtra por estado activo/inactivo"),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> Page[ClientRead]:
    items, total = ClientService(db).list(search=q, is_active=is_active, params=params)
    return Page[ClientRead].build([ClientRead.model_validate(c) for c in items], total, params)


@router.post(
    "",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un cliente",
    responses={409: {"description": "Número de identificación duplicado"}},
)
def create_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> ClientRead:
    return ClientRead.model_validate(ClientService(db).create(data))


@router.get("/{client_id}", response_model=ClientRead, summary="Consultar un cliente")
def get_client(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> ClientRead:
    return ClientRead.model_validate(ClientService(db).get(client_id))


@router.patch(
    "/{client_id}",
    response_model=ClientRead,
    summary="Actualizar un cliente (incluye activar/desactivar)",
    responses={404: {"description": "No encontrado"}, 409: {"description": "Identificación duplicada"}},
)
def update_client(
    client_id: uuid.UUID,
    data: ClientUpdate,
    db: Session = Depends(get_db),
    _: CurrentUser = Depends(get_current_user),
) -> ClientRead:
    return ClientRead.model_validate(ClientService(db).update(client_id, data))
