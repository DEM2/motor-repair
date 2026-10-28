# Modelo de datos

La persistencia usa **PostgreSQL 16** con **dos bases de datos independientes** en la misma instancia:

| Base de datos | Usuario | Dueño | Tablas |
|---|---|---|---|
| `auth_db` | `auth_user` | auth-service | `users`, `migrations` |
| `business_db` | `business_user` | business-service | `clients`, `engines`, `repair_orders`, `repair_order_status_history`, `alembic_version` |

`infra/postgres/init/01-create-databases.sh` crea ambas bases de datos y revoca el acceso público (`REVOKE ALL ON DATABASE ... FROM PUBLIC`). Por eso `business_user` **no puede conectarse** a `auth_db`, y viceversa:

```text
$ psql -U business_user -d auth_db
FATAL: permission denied for database "auth_db"
DETAIL: User does not have CONNECT privilege.
```

## 1. auth_db

```mermaid
erDiagram
    users {
        uuid id PK
        varchar(255) email UK "siempre en minúsculas"
        varchar(120) full_name
        varchar(255) password_hash "bcrypt, nunca se expone"
        user_role role "ADMIN | OPERATOR"
        boolean is_active "desactivación lógica"
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }
```

## 2. business_db

```mermaid
erDiagram
    clients ||--o{ engines : "es propietario de"
    clients ||--o{ repair_orders : "propietario al recibir"
    engines ||--o{ repair_orders : "se repara en"
    repair_orders ||--|{ repair_order_status_history : "registra"

    clients {
        uuid id PK
        varchar(150) name "nombre o razón social"
        identification_type identification_type "NIT | CC | CE | PASSPORT"
        varchar(30) identification_number UK
        varchar(255) email
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    engines {
        uuid id PK
        varchar(60) serial_number UK "código interno / serie"
        varchar(100) manufacturer "texto abierto"
        varchar(100) model "texto abierto"
        varchar(100) engine_type "texto abierto"
        varchar(60) power "potencia o capacidad, texto abierto"
        uuid client_id FK
        timestamptz registered_at "fecha de registro"
        timestamptz updated_at
        boolean is_active
    }

    repair_orders {
        uuid id PK
        varchar(20) order_number UK "OT-AAAA-000001"
        uuid engine_id FK
        uuid client_id FK
        date reception_date
        text reported_problem
        text diagnosis "nullable"
        text work_performed "nullable"
        varchar(120) technician "dato de referencia"
        date estimated_delivery_date
        date actual_delivery_date "nullable"
        repair_status status
        text observations "nullable"
        varchar(64) created_by_user_id "sub del JWT"
        varchar(255) created_by_email
        timestamptz created_at
        timestamptz updated_at
    }

    repair_order_status_history {
        uuid id PK
        uuid repair_order_id FK
        repair_status from_status "null en la creación"
        repair_status to_status
        text note
        varchar(64) changed_by_user_id
        varchar(255) changed_by_email
        timestamptz changed_at
    }
```

### Relación con los usuarios

Entre `business_db` y `auth_db` **no hay claves foráneas**. Las órdenes y el historial guardan el `sub` (id) y el correo del usuario **tal como venían en el JWT verificado**. Así se consigue:

- Trazabilidad: se sabe quién creó cada orden y quién hizo cada cambio de estado.
- Independencia: business-service funciona aunque auth-service esté caído, y nunca consulta sus tablas.

## 3. Reglas de integridad

| Regla | Dónde se aplica |
|---|---|
| Correo de usuario único (sin distinguir mayúsculas) | Validación con Zod (pasa a minúsculas) + `UNIQUE (email)` |
| Número de identificación del cliente único | Servicio (409) + `UNIQUE (identification_number)`; se normaliza en mayúsculas y sin espacios |
| Número de serie del motor único | Servicio (409) + `UNIQUE (serial_number)`; se normaliza en mayúsculas |
| Número de orden único y consecutivo | Secuencia `repair_order_number_seq` (segura con concurrencia) + `UNIQUE` |
| Un motor solo pertenece a un cliente activo | Servicio (`BUSINESS_RULE_VIOLATION`) |
| Las órdenes solo se crean para motores y clientes activos | Servicio |
| Máximo **una orden abierta** (no entregada) por motor | Servicio + índice único parcial `uq_repair_orders_one_open_per_engine WHERE status <> 'DELIVERED'` |
| Entrega estimada ≥ recepción; entrega real ≥ recepción | Esquema Pydantic / servicio + `CHECK` en la base de datos |
| No se borra un cliente o un motor con datos asociados | `FOREIGN KEY ... ON DELETE RESTRICT` |

Las reglas se validan primero en la aplicación, para dar mensajes claros, y se repiten en la base de datos (defensa en profundidad). Si una condición de carrera llegara a violar una restricción, el manejador global la convierte en un `409 Conflict`.

## 4. Máquina de estados de la orden

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: Crear orden
    RECEIVED --> IN_DIAGNOSIS
    IN_DIAGNOSIS --> AWAITING_APPROVAL: requiere diagnóstico
    AWAITING_APPROVAL --> IN_REPAIR
    IN_REPAIR --> IN_TESTING
    IN_TESTING --> IN_REPAIR: falla en pruebas
    IN_TESTING --> COMPLETED: requiere trabajo realizado
    COMPLETED --> DELIVERED: registra fecha real de entrega
    DELIVERED --> [*]
```

| Código | Etiqueta en la interfaz |
|---|---|
| `RECEIVED` | Recibido |
| `IN_DIAGNOSIS` | En diagnóstico |
| `AWAITING_APPROVAL` | Esperando aprobación |
| `IN_REPAIR` | En reparación |
| `IN_TESTING` | En pruebas |
| `COMPLETED` | Finalizado |
| `DELIVERED` | Entregado |

## 5. Inicialización

| Paso | Cuándo | Qué hace |
|---|---|---|
| `infra/postgres/init/01-create-databases.sh` | Primer arranque del contenedor de PostgreSQL (volumen vacío) | Crea las bases de datos y los usuarios aislados |
| Migraciones de TypeORM | Al iniciar auth-service (`server.ts`) o con `npm run migrate` | Crea la tabla `users` |
| Seed del administrador | Al iniciar auth-service | Crea `ADMIN_EMAIL` si no existe (idempotente) |
| `alembic upgrade head` | Al iniciar el contenedor de business-service | Crea las tablas de negocio, la secuencia, los índices y los `CHECK` |
