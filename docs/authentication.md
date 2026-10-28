# Autenticación entre servicios y gestión de llaves

## 1. Principio

> **auth-service es el único que autentica y el único que puede emitir tokens.
> business-service solo verifica tokens.**

Esto se consigue con **JWT firmados con RS256**, un algoritmo de firma asimétrica (RSA + SHA-256):

| Llave | Quién la tiene | Para qué sirve |
|---|---|---|
| 🔑 **Privada** (`jwt_private.pem`) | Solo auth-service | **Firmar** tokens |
| 🔓 **Pública** (`jwt_public.pem`) | business-service (y cualquier servicio futuro) | **Verificar** firmas. No permite firmar |

Ambos servicios comparten la **configuración de validación** (algoritmo `RS256`, emisor `JWT_ISSUER` y audiencia `JWT_AUDIENCE`), pero **no comparten credenciales de usuarios ni secretos de firma**.

## 2. Contenido del token

```json
// Header
{ "alg": "RS256", "typ": "JWT" }

// Payload
{
  "sub": "3f0c6c1e-6f1a-4d5b-9a51-2b1f8a0e7c11",  // id del usuario (identificación)
  "email": "admin@taller.local",
  "name": "Administrador del taller",
  "role": "ADMIN",                                 // información de autorización
  "iss": "motor-repair-auth",                      // emisor
  "aud": "motor-repair-api",                       // audiencia
  "iat": 1761609600,                               // emitido en
  "exp": 1761613200,                               // expira en (JWT_EXPIRES_IN, por defecto 1h)
  "jti": "9b1d…"                                   // id único del token
}
```

## 3. Qué valida business-service

`app/core/security.py` usa `jwt.decode(...)` de PyJWT con la llave pública. **No se limita a decodificar el token: verifica la firma criptográficamente.**

| Verificación | Cómo | Resultado si falla |
|---|---|---|
| Firma RS256 válida | Llave pública RSA | 401 `Token inválido` |
| Algoritmo permitido | `algorithms=["RS256"]` (lista blanca) | 401. Bloquea `alg: none` y la **confusión de algoritmo** HS256 |
| No expirado | Claim `exp` | 401 `El token ha expirado` |
| Emisor correcto | `issuer=JWT_ISSUER` | 401 |
| Audiencia correcta | `audience=JWT_AUDIENCE` | 401 |
| Claims obligatorios | `require: exp, iat, sub, iss, aud` | 401 |
| Rol conocido | `role ∈ {ADMIN, OPERATOR}` | 401 |

Cada caso está cubierto por pruebas automatizadas en `business-service/tests/test_security.py` y `auth-service/tests/unit/jwt.test.ts`.

## 4. Contraseñas

- Se almacenan con **bcrypt** (sal aleatoria por contraseña, costo configurable `BCRYPT_SALT_ROUNDS`, 12 por defecto).
- Política: entre 8 y 72 caracteres, con al menos una mayúscula, una minúscula y un número. El límite de 72 se debe a que bcrypt solo considera los primeros 72 bytes.
- El login responde **el mismo mensaje** tanto para un correo inexistente como para una contraseña incorrecta. Además, compara contra un hash ficticio para que el tiempo de respuesta sea similar en ambos casos, lo que evita la enumeración de usuarios.
- La columna `password_hash` tiene `select: false`: nunca se carga por accidente y ninguna respuesta la incluye.

## 5. Configuración de las llaves por entorno

### Local (sin Docker)

```bash
node scripts/generate-keys.mjs     # crea keys/jwt_private.pem y keys/jwt_public.pem
```

- `auth-service/.env` → `JWT_PRIVATE_KEY_PATH=../keys/jwt_private.pem`
- `business-service/.env` → `JWT_PUBLIC_KEY_PATH=../keys/jwt_public.pem`
- La carpeta `keys/` y los archivos `*.pem` están en `.gitignore`.

### Docker Compose

Las llaves se montan como **Docker secrets** en `/run/secrets/`, sin variables de entorno visibles con `docker inspect`. Además, **cada contenedor recibe solo la llave que necesita**:

```yaml
auth-service:
  environment:
    JWT_PRIVATE_KEY_PATH: /run/secrets/jwt_private_key
  secrets: [jwt_private_key]        # solo la privada

business-service:
  environment:
    JWT_PUBLIC_KEY_PATH: /run/secrets/jwt_public_key
  secrets: [jwt_public_key]         # solo la pública
```

### Pruebas automatizadas y CI

- Cada ejecución de pruebas **genera un par de llaves efímero en memoria**, sin depender de archivos ni de secretos reales.
- El job `e2e` del pipeline genera llaves desechables con el mismo script y las destruye al terminar.

### Producción (recomendado)

- Guardar la llave privada en un gestor de secretos (GitHub Actions Secrets, AWS Secrets Manager, Azure Key Vault, HashiCorp Vault…) e inyectarla con `JWT_PRIVATE_KEY`. Ambos servicios aceptan el PEM en una sola línea con `\n`.
- Distribuir la llave pública libremente a los servicios que verifican (`JWT_PUBLIC_KEY`).
- **Rotación**: generar un nuevo par, desplegar primero la nueva llave pública en los verificadores y luego la privada en auth-service. Los tokens antiguos dejan de ser válidos como máximo al cumplirse `JWT_EXPIRES_IN`.

| Variable | auth-service | business-service |
|---|---|---|
| `JWT_PRIVATE_KEY` / `JWT_PRIVATE_KEY_PATH` | ✅ obligatoria (una de las dos) | ❌ nunca |
| `JWT_PUBLIC_KEY` / `JWT_PUBLIC_KEY_PATH` | — (la deriva de la privada) | ✅ obligatoria (una de las dos) |
| `JWT_ISSUER` | ✅ (emite) | ✅ (valida) |
| `JWT_AUDIENCE` | ✅ (emite) | ✅ (valida) |
| `JWT_EXPIRES_IN` | ✅ | — |

Ambos servicios **validan la configuración al arrancar**: si falta la llave o no es RSA, el servicio no inicia.

## 6. Sesión en el frontend

1. `POST /api/auth/login` a auth-service. Es la **única** API de autenticación que usa el frontend.
2. Se guardan el token y el usuario en `sessionStorage`.
3. Cada petición a business-service envía `Authorization: Bearer <token>`.
4. La sesión se cierra automáticamente cuando el token expira (se lee `exp`) o si cualquier API responde `401`.
5. Las rutas de administración solo se muestran a usuarios con rol `ADMIN`. Esto es solo una ayuda visual: la autorización real la aplican las APIs.

## 7. Limitaciones conocidas

- **Revocación**: un token emitido sigue siendo válido en business-service hasta que expira, aunque el usuario sea desactivado. Se mitiga con una expiración corta (1 h). En auth-service, `GET /api/auth/me` sí consulta la base de datos y rechaza a los usuarios desactivados. Una mejora futura sería usar tokens de acceso más cortos con refresh tokens, o una lista de revocación.
- No se implementó limitación de intentos de login (rate limiting) porque está fuera del alcance pedido. Es la siguiente mejora recomendada.
