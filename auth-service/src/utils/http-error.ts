/**
 * Error de dominio con un código HTTP asociado.
 *
 * Los servicios lanzan HttpError y el middleware centralizado de errores
 * (middlewares/error-handler.ts) lo convierte en una respuesta JSON uniforme:
 *
 *   { "error": { "code": "CONFLICT", "message": "...", "details": ... } }
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Atajos para los errores más comunes; hacen el código de los servicios más legible. */
export const Errors = {
  badRequest: (message: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'No autenticado') => new HttpError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'No tiene permisos para realizar esta acción') => new HttpError(403, 'FORBIDDEN', message),
  notFound: (message = 'Recurso no encontrado') => new HttpError(404, 'NOT_FOUND', message),
  conflict: (message: string) => new HttpError(409, 'CONFLICT', message),
};
