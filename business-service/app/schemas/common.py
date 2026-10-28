"""Esquemas compartidos: paginación y utilidades de validación."""

import math
from typing import Annotated, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, ConfigDict, StringConstraints

T = TypeVar("T")

# Texto obligatorio: se recortan espacios y no puede quedar vacío.
NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ORMModel(BaseModel):
    """Base para respuestas construidas a partir de objetos SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)


class PageParams(BaseModel):
    page: int
    size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def page_params(
    page: int = Query(1, ge=1, description="Número de página (desde 1)"),
    size: int = Query(20, ge=1, le=100, description="Elementos por página (máx. 100)"),
) -> PageParams:
    return PageParams(page=page, size=size)


class Page(BaseModel, Generic[T]):
    """Respuesta paginada genérica."""

    items: list[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        return cls(
            items=items,
            total=total,
            page=params.page,
            size=params.size,
            pages=math.ceil(total / params.size) if total else 0,
        )
