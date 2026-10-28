/**
 * Emisión y verificación de tokens JWT con RS256 (RSA + SHA-256).
 *
 * - FIRMA: solo este servicio posee la llave PRIVADA, por lo tanto es el único que
 *   puede emitir tokens válidos.
 * - VERIFICACIÓN: cualquier servicio con la llave PÚBLICA (por ejemplo, business-service)
 *   puede comprobar la firma, pero no puede fabricar tokens.
 *
 * Claims incluidos:
 *   sub   -> id del usuario (identificación)
 *   email, name
 *   role  -> ADMIN | OPERATOR (información de autorización)
 *   iss   -> emisor (JWT_ISSUER)
 *   aud   -> audiencia (JWT_AUDIENCE)
 *   iat / exp -> emisión y expiración
 *   jti   -> identificador único del token
 */
import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from '../entities/User';
import { Errors } from './http-error';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface IssuedToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export function signAccessToken(claims: AccessTokenClaims): IssuedToken {
  const { sub, ...payload } = claims;
  const accessToken = jwt.sign(payload, config.jwt.privateKey, {
    algorithm: 'RS256',
    subject: sub,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
    jwtid: randomUUID(),
  });
  return { accessToken, tokenType: 'Bearer', expiresIn: config.jwt.expiresInSeconds };
}

/**
 * Verifica firma, algoritmo, expiración, emisor y audiencia.
 * Fijar `algorithms: ['RS256']` evita el ataque de "confusión de algoritmo"
 * (un token HS256 firmado usando la llave pública como secreto).
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwt.publicKey, {
      algorithms: ['RS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError ? 'El token ha expirado' : 'Token inválido';
    throw Errors.unauthorized(message);
  }

  if (
    typeof decoded === 'string' ||
    typeof decoded.sub !== 'string' ||
    !Object.values(UserRole).includes(decoded.role as UserRole)
  ) {
    throw Errors.unauthorized('Token inválido');
  }

  return {
    sub: decoded.sub,
    email: String(decoded.email),
    name: String(decoded.name),
    role: decoded.role as UserRole,
  };
}
