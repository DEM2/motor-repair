"""Esquemas de clientes."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints, model_validator

from app.models.client import IdentificationType
from app.schemas.common import ORMModel

ClientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
# Se normaliza en mayúsculas y sin espacios para que "900.123-1" y "900.123-1 " sean el mismo.
IdentificationNumber = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=3, max_length=30, pattern=r"^[A-Za-z0-9.\-]+$"),
    AfterValidator(str.upper),
]
NormalizedEmail = Annotated[EmailStr, AfterValidator(str.lower)]


class ClientCreate(BaseModel):
    name: ClientName = Field(examples=["Minera del Cesar S.A.S."])
    identification_type: IdentificationType = Field(examples=["NIT"])
    identification_number: IdentificationNumber = Field(examples=["900123456-1"])
    email: NormalizedEmail = Field(examples=["mantenimiento@mineracesar.co"])
    is_active: bool = True


class ClientUpdate(BaseModel):
    """Actualización parcial: solo se modifican los campos enviados."""

    name: ClientName | None = None
    identification_type: IdentificationType | None = None
    identification_number: IdentificationNumber | None = None
    email: NormalizedEmail | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ClientUpdate":
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo para actualizar")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"El campo '{field}' no puede ser nulo")
        return self


class ClientSummary(ORMModel):
    id: uuid.UUID
    name: str
    identification_type: IdentificationType
    identification_number: str


class ClientRead(ClientSummary):
    email: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
