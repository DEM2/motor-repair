/**
 * Especificación OpenAPI 3 del servicio de autenticación.
 * Se publica en /docs (Swagger UI) y en /openapi.json.
 */
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const userIdParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Auth Service — Plataforma de reparación de motores',
    version: '1.0.0',
    description:
      'Gestión de identidad: inicio de sesión, emisión de JWT (RS256) y administración de usuarios y roles.\n\n' +
      'Para probar los endpoints protegidos: ejecute `POST /api/auth/login`, copie `accessToken` y péguelo en **Authorize**.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth', description: 'Inicio de sesión, perfil y registro' },
    { name: 'Users', description: 'Administración de usuarios' },
    { name: 'Health', description: 'Estado del servicio' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Role: { type: 'string', enum: ['ADMIN', 'OPERATOR'] },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          role: { $ref: '#/components/schemas/Role' },
          isActive: { type: 'boolean' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@taller.local' },
          password: { type: 'string', example: 'change-me-Admin123' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', description: 'Segundos hasta la expiración', example: 3600 },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'fullName', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string', minLength: 3, maxLength: 120 },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 72,
            description: 'Debe incluir mayúscula, minúscula y número',
          },
          role: { $ref: '#/components/schemas/Role' },
        },
      },
      UpdateUserRequest: {
        type: 'object',
        minProperties: 1,
        properties: {
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          password: { type: 'string' },
          role: { $ref: '#/components/schemas/Role' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Estado del servicio y de la base de datos',
        responses: { '200': { description: 'Servicio operativo' }, '503': { description: 'Base de datos no disponible' } },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicia sesión con correo y contraseña',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': {
            description: 'Autenticación exitosa',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
          },
          '400': errorResponse('Datos inválidos'),
          '401': errorResponse('Credenciales incorrectas'),
          '403': errorResponse('Usuario desactivado'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Perfil del usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Perfil', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '401': errorResponse('Token ausente, inválido o expirado'),
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registra un nuevo usuario (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          '201': { description: 'Usuario creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '400': errorResponse('Datos inválidos'),
          '401': errorResponse('No autenticado'),
          '403': errorResponse('Requiere rol ADMIN'),
          '409': errorResponse('El correo ya está registrado'),
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'Lista todos los usuarios (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Listado',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } },
          },
          '401': errorResponse('No autenticado'),
          '403': errorResponse('Requiere rol ADMIN'),
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Consulta un usuario (ADMIN o el propio usuario)',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        responses: {
          '200': { description: 'Usuario', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '403': errorResponse('Sin permisos'),
          '404': errorResponse('No encontrado'),
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Actualiza un usuario (ADMIN; o el propio usuario sin cambiar su rol)',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateUserRequest' } } },
        },
        responses: {
          '200': { description: 'Usuario actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '400': errorResponse('Datos inválidos'),
          '403': errorResponse('Sin permisos'),
          '404': errorResponse('No encontrado'),
          '409': errorResponse('Correo duplicado'),
        },
      },
    },
    '/api/users/{id}/deactivate': {
      patch: {
        tags: ['Users'],
        summary: 'Desactiva un usuario (solo ADMIN; no puede desactivarse a sí mismo)',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        responses: {
          '200': { description: 'Usuario desactivado', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '400': errorResponse('Intento de auto-desactivación'),
          '403': errorResponse('Requiere rol ADMIN'),
          '404': errorResponse('No encontrado'),
        },
      },
    },
    '/api/users/{id}/activate': {
      patch: {
        tags: ['Users'],
        summary: 'Reactiva un usuario (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        responses: {
          '200': { description: 'Usuario activado', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '403': errorResponse('Requiere rol ADMIN'),
          '404': errorResponse('No encontrado'),
        },
      },
    },
  },
};
