# Plataforma de gestión de reparaciones de motores de minería pesada

Aplicación distribuida para registrar y hacer seguimiento a los motores que ingresan a un taller de reparación.

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| `auth-service/` | Express + TypeScript + TypeORM | Usuarios, roles, login y emisión de JWT (RS256) |
| `business-service/` | FastAPI + SQLAlchemy + Alembic | Clientes, motores, órdenes de reparación e historial de estados |
| `frontend/` | React + TypeScript (Vite) | Interfaz web |
| `infra/postgres/` | PostgreSQL 16 | Una base de datos y un usuario por servicio |

> 🚧 En construcción: este README se completa a medida que se implementa cada servicio.

## Inicio rápido

```bash
cp .env.example .env            # 1. Variables de entorno (ajusta las contraseñas)
./scripts/generate-keys.sh      # 2. Par de llaves RSA para los JWT (queda en ./keys, ignorado por git)
docker compose up -d            # 3. Levanta la infraestructura
```

## Estructura del repositorio

```
.
├── auth-service/        # API de autenticación y usuarios (Express)
├── business-service/    # API de negocio (FastAPI)
├── frontend/            # Aplicación web (React)
├── infra/postgres/      # Scripts de inicialización de la base de datos
├── scripts/             # Utilidades (generación de llaves, etc.)
├── docs/                # Documentación técnica
├── keys/                # Llaves JWT locales (NO versionadas)
└── .github/workflows/   # Pipelines de CI/CD
```

## Flujo de trabajo con Git

- `main`: rama estable; solo recibe cambios por pull request con el pipeline en verde.
- `feature/*`: una rama por funcionalidad (por ejemplo, `feature/auth-service`).
- Commits con el formato [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`.
