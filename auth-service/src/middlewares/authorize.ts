/**
 * Middleware de autorización por roles. Debe ir DESPUÉS de `authenticate`.
 *
 *   router.get('/', authenticate, authorize(UserRole.ADMIN), controller.list)
 */
import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../entities/User';
import { Errors } from '../utils/http-error';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      throw Errors.unauthorized();
    }
    if (!allowedRoles.includes(req.auth.role)) {
      throw Errors.forbidden();
    }
    next();
  };
}
