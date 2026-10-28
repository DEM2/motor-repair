"""Esquemas de motores."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

from app.schemas.client import ClientSummary
from app.schemas.common import ORMModel

# Número de serie normalizado en mayúsculas para detectar duplicados sin importar el formato.
SerialNumber = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60), AfterValidator(str.upper)
]
Text100 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Text60 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class EngineCreate(BaseModel):
    serial_number: SerialNumber = Field(examples=["CAT-3516B-0001"])
    manufacturer: Text100 = Field(examples=["Caterpillar"])
    model: Text100 = Field(examples=["3516B"])
    engine_type: Text100 = Field(examples=["Diésel V16"])
    power: Text60 = Field(examples=["2000 HP"])
    client_id: uuid.UUID
    is_active: bool = True


class EngineUpdate(BaseModel):
    serial_number: SerialNumber | None = None
    manufacturer: Text100 | None = None
    model: Text100 | None = None
    engine_type: Text100 | None = None
    power: Text60 | None = None
    client_id: uuid.UUID | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "EngineUpdate":
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo para actualizar")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"El campo '{field}' no puede ser nulo")
        return self


class EngineSummary(ORMModel):
    id: uuid.UUID
    serial_number: str
    manufacturer: str
    model: str


class EngineRead(EngineSummary):
    engine_type: str
    power: str
    client_id: uuid.UUID
    client: ClientSummary
    registered_at: datetime
    updated_at: datetime
    is_active: bool
