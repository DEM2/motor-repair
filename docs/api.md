# Endpoints principales

La documentación interactiva completa (OpenAPI/Swagger) está disponible con los servicios en ejecución:

| Servicio | Swagger UI | Especificación |
|---|---|---|
| auth-service | http://localhost:4000/docs | http://localhost:4000/openapi.json |
| business-service | http://localhost:8000/docs (también `/redoc`) | http://localhost:8000/openapi.json |

**Formato de error común** (ambos servicios):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Los datos enviados no son válidos", "details": [ { "field": "email", "message": "..." } ] } }
```

| Código HTTP | `code` | Significado |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `BAD_REQUEST` | Entrada inválida (auth-service) |
| 422 | `VALIDATION_ERROR` | Entrada inválida (business-service, estándar de FastAPI) |
| 401 | `UNAUTHORIZED` | Sin token, o token inválido o expirado |
| 403 | `FORBIDDEN`, `USER_INACTIVE` | Sin permisos para la acción / usuario desactivado |
| 404 | `NOT_FOUND` | Recurso o ruta inexistente |
| 409 | `CONFLICT`, `BUSINESS_RULE_VIOLATION` | Duplicado / regla de negocio violada |
| 500 | `INTERNAL_ERROR` | Error no controlado (el detalle solo queda en los logs) |

---

## auth-service (Express) — `http://localhost:4000`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | Público | Inicia sesión y devuelve `{ accessToken, tokenType, expiresIn, user }` |
| `GET` | `/api/auth/me` | JWT | Perfil del usuario autenticado |
| `POST` | `/api/auth/register` | ADMIN | Registra un usuario `{ email, fullName, password, role }` |
| `GET` | `/api/users` | ADMIN | Lista los usuarios |
| `GET` | `/api/users/:id` | ADMIN o el propio usuario | Consulta un usuario |
| `PATCH` | `/api/users/:id` | ADMIN o el propio usuario (sin cambiar su rol) | Actualiza `email`, `fullName`, `password` o `role` |
| `PATCH` | `/api/users/:id/deactivate` | ADMIN (no sobre sí mismo) | Desactiva el usuario: ya no puede iniciar sesión |
| `PATCH` | `/api/users/:id/activate` | ADMIN | Reactiva el usuario |
| `GET` | `/health` | Público | Estado del servicio y de la base de datos |

**Ejemplo:**

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@taller.local","password":"change-me-Admin123"}'
```

---

## business-service (FastAPI) — `http://localhost:8000`

Todos los endpoints bajo `/api` requieren `Authorization: Bearer <JWT>`. Los listados aceptan `page` (desde 1) y `size` (máximo 100) y responden `{ items, total, page, size, pages }`.

### Clientes

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/clients?q=&is_active=` | Lista y busca por nombre, identificación o correo |
| `POST` | `/api/clients` | Registra un cliente (409 si el número de identificación ya existe) |
| `GET` | `/api/clients/{id}` | Consulta un cliente |
| `PATCH` | `/api/clients/{id}` | Actualización parcial, incluido `is_active` |

### Motores

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/engines?q=&client_id=&is_active=` | Lista y busca por serie, fabricante, modelo o tipo |
| `POST` | `/api/engines` | Registra un motor (409 si la serie está duplicada o el cliente está inactivo) |
| `GET` | `/api/engines/{id}` | Consulta un motor, con su propietario |
| `PATCH` | `/api/engines/{id}` | Actualización parcial, incluido el cambio de propietario o `is_active` |

### Órdenes de reparación

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/repair-orders?q=&status=&client_id=&engine_id=` | Lista con búsqueda (número, técnico, problema, serie o cliente) y filtros |
| `GET` | `/api/repair-orders/summary` | Conteo por estado, para el dashboard |
| `POST` | `/api/repair-orders` | Crea la orden en estado `RECEIVED`. El cliente se toma del propietario del motor |
| `GET` | `/api/repair-orders/{id}` | Detalle con `status_history` y `allowed_next_statuses` |
| `PATCH` | `/api/repair-orders/{id}/status` | Cambia el estado `{ status, note?, diagnosis?, work_performed?, actual_delivery_date? }` |
| `GET` | `/health` | Estado del servicio (público) |

**Ejemplo de ciclo completo:**

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@taller.local","password":"change-me-Admin123"}' | jq -r .accessToken)

# Sin token → 401
curl -i http://localhost:8000/api/clients

CLIENT=$(curl -s -X POST http://localhost:8000/api/clients -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Minera del Cesar","identification_type":"NIT","identification_number":"900123456-1","email":"mtto@minera.co"}' | jq -r .id)

ENGINE=$(curl -s -X POST http://localhost:8000/api/engines -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"serial_number\":\"CAT-3516B-001\",\"manufacturer\":\"Caterpillar\",\"model\":\"3516B\",\"engine_type\":\"Diésel V16\",\"power\":\"2000 HP\",\"client_id\":\"$CLIENT\"}" | jq -r .id)

ORDER=$(curl -s -X POST http://localhost:8000/api/repair-orders -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"engine_id\":\"$ENGINE\",\"reported_problem\":\"Humo azul y pérdida de potencia\",\"technician\":\"Carlos Pérez\",\"estimated_delivery_date\":\"2026-12-15\"}" | jq -r .id)

curl -s -X PATCH http://localhost:8000/api/repair-orders/$ORDER/status -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"IN_DIAGNOSIS","note":"Motor en banco de pruebas"}' | jq .status
```
