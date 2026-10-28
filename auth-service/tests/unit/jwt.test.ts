/**
 * Pruebas unitarias de emisión y verificación de JWT (no requieren base de datos).
 * Cubren los ataques y errores más comunes: firma alterada, expiración, otra llave,
 * emisor/audiencia incorrectos y confusión de algoritmo (HS256 con la llave pública).
 */
import { createHmac, generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env';
import { UserRole } from '../../src/entities/User';
import { HttpError } from '../../src/utils/http-error';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt';

const claims = { sub: '7f3c1a9e-1b2c-4d5e-8f90-123456789abc', email: 'a@b.co', name: 'Ana', role: UserRole.ADMIN };

function expectUnauthorized(fn: () => unknown, message?: string): void {
  try {
    fn();
    throw new Error('Se esperaba un error');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(401);
    if (message) expect((error as HttpError).message).toBe(message);
  }
}

describe('JWT RS256', () => {
  it('firma un token con los claims requeridos y lo verifica', () => {
    const { accessToken, tokenType, expiresIn } = signAccessToken(claims);
    expect(tokenType).toBe('Bearer');
    expect(expiresIn).toBe(3600);

    const header = JSON.parse(Buffer.from(accessToken.split('.')[0], 'base64url').toString());
    expect(header.alg).toBe('RS256');

    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
    expect(decoded).toMatchObject({
      sub: claims.sub,
      role: 'ADMIN',
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
    });
    expect(decoded.exp! - decoded.iat!).toBe(3600);
    expect(decoded.jti).toBeDefined();

    expect(verifyAccessToken(accessToken)).toEqual(claims);
  });

  it('rechaza un token con la firma alterada', () => {
    const { accessToken } = signAccessToken(claims);
    const [header, , signature] = accessToken.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ ...claims, role: 'ADMIN', sub: 'otro' })).toString('base64url');
    expectUnauthorized(() => verifyAccessToken(`${header}.${forgedPayload}.${signature}`), 'Token inválido');
  });

  it('rechaza un token expirado', () => {
    const expired = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }, config.jwt.privateKey, {
      algorithm: 'RS256',
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
    expectUnauthorized(() => verifyAccessToken(expired), 'El token ha expirado');
  });

  it('rechaza un token firmado con otra llave privada', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const foreign = jwt.sign({ email: claims.email, name: claims.name, role: claims.role }, privateKey, {
      algorithm: 'RS256',
      subject: claims.sub,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: '1h',
    });
    expectUnauthorized(() => verifyAccessToken(foreign));
  });

  it('rechaza emisor o audiencia incorrectos', () => {
    const wrongAudience = jwt.sign({ role: 'ADMIN' }, config.jwt.privateKey, {
      algorithm: 'RS256',
      subject: claims.sub,
      issuer: config.jwt.issuer,
      audience: 'otra-api',
      expiresIn: '1h',
    });
    const wrongIssuer = jwt.sign({ role: 'ADMIN' }, config.jwt.privateKey, {
      algorithm: 'RS256',
      subject: claims.sub,
      issuer: 'otro-emisor',
      audience: config.jwt.audience,
      expiresIn: '1h',
    });
    expectUnauthorized(() => verifyAccessToken(wrongAudience));
    expectUnauthorized(() => verifyAccessToken(wrongIssuer));
  });

  it('rechaza la confusión de algoritmo (HS256 firmado con la llave pública)', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ ...claims, iss: config.jwt.issuer, aud: config.jwt.audience, exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString('base64url');
    const signature = createHmac('sha256', config.jwt.publicKey)
      .update(`${header}.${payload}`)
      .digest('base64url');
    expectUnauthorized(() => verifyAccessToken(`${header}.${payload}.${signature}`));
  });

  it('rechaza un token con un rol desconocido', () => {
    const token = jwt.sign({ role: 'SUPERUSER' }, config.jwt.privateKey, {
      algorithm: 'RS256',
      subject: claims.sub,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: '1h',
    });
    expectUnauthorized(() => verifyAccessToken(token));
  });
});
