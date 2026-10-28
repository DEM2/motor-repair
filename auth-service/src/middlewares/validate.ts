/**
 * Validación de entradas con Zod.
 *
 * Valida `req.body` y/o `req.params` contra un esquema. Si los datos son válidos los
 * reemplaza por la versión ya transformada (por ejemplo, el correo en minúsculas);
 * si no, responde 400 con el detalle de cada campo inválido.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { HttpError } from '../utils/http-error';

interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: { location: string; field: string; message: string }[] = [];

    for (const location of ['params', 'body'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location] ?? {});
      if (result.success) {
        req[location] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({ location, field: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (errors.length > 0) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', errors);
    }
    next();
  };
}
