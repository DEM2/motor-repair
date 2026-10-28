/**
 * Manejo centralizado de errores.
 *
 * Todos los errores (lanzados en controladores, servicios o middlewares) terminan aquí
 * y se convierten en una respuesta JSON con un formato único:
 *
 *   { "error": { "code": "...", "message": "...", "details"?: ... } }
 *
 * Express 5 propaga automáticamente los errores de funciones async, por lo que no hace
 * falta envolver cada controlador en try/catch.
 */
import type { NextFunction, Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { HttpError } from '../utils/http-error';

const PG_UNIQUE_VIOLATION = '23505';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // 1. Errores de negocio controlados.
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // 2. JSON mal formado en el cuerpo de la petición (lo detecta express.json()).
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido' } });
    return;
  }

  // 3. Violación de unicidad en la base de datos (última línea de defensa ante condiciones de carrera).
  if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'El registro ya existe' } });
    return;
  }

  // 4. Cualquier otro error: se registra completo en el servidor, pero al cliente
  //    solo se le envía un mensaje genérico para no filtrar detalles internos.
  console.error('[error]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
}
