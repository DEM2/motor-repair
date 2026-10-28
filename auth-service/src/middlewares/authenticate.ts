/**
 * Middleware de autenticación.
 *
 * Exige el encabezado `Authorization: Bearer <token>`, verifica el JWT (firma RS256,
 * expiración, emisor y audiencia) y deja la identidad del usuario en `req.auth`
 * para que los siguientes middlewares y controladores la usen.
 */
import type { NextFunction, Request, Response } from 'express';
import { Errors } from '../utils/http-error';
import { verifyAccessToken, type AccessTokenClaims } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Identidad del usuario autenticado (disponible después de `authenticate`). */
      auth?: AccessTokenClaims;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header) {
    throw Errors.unauthorized('Falta el encabezado Authorization');
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw Errors.unauthorized('El encabezado Authorization debe tener el formato "Bearer <token>"');
  }

  req.auth = verifyAccessToken(token);
  next();
}

/** Devuelve la identidad autenticada o falla si el middleware no se ejecutó. */
export function requireAuth(req: Request): AccessTokenClaims {
  if (!req.auth) {
    throw Errors.unauthorized();
  }
  return req.auth;
}
