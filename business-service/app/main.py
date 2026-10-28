"""Punto de entrada de la API de negocio (FastAPI).

Documentación interactiva:
  - Swagger UI: /docs
  - ReDoc:      /redoc
  - OpenAPI:    /openapi.json
"""

import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import clients, engines, health, repair_orders
from app.core.config import get_settings
from app.core.errors import register_exception_handlers

DESCRIPTION = """
Gestión de **clientes**, **motores** y **órdenes de reparación** del taller.

### Autenticación
Todos los endpoints de `/api` exigen un JWT emitido por **auth-service**
(`POST /api/auth/login`). Este servicio verifica la firma RS256 con la llave
pública, la expiración, el emisor y la audiencia. Use el botón **Authorize**
y pegue el `accessToken`.
"""


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    app = FastAPI(
        title="Business Service — Plataforma de reparación de motores",
        version="1.0.0",
        description=DESCRIPTION,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    register_exception_handlers(app)

    api = APIRouter(prefix="/api")
    api.include_router(clients.router)
    api.include_router(engines.router)
    api.include_router(repair_orders.router)

    app.include_router(health.router)
    app.include_router(api)
    return app


app = create_app()
