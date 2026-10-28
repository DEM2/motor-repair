/**
 * Lectura del payload de un JWT en el navegador.
 *
 * IMPORTANTE: aquí solo se DECODIFICA (sin verificar la firma) para conocer la fecha de
 * expiración y cerrar la sesión a tiempo. La verificación criptográfica real la hacen
 * los backends en cada petición; el frontend nunca decide permisos de forma confiable.
 */
export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR';
  exp: number;
  iat: number;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

/** Milisegundos que le quedan al token (0 si ya expiró o es ilegible). */
export function msUntilExpiry(token: string, now: number = Date.now()): number {
  const payload = decodeToken(token);
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp * 1000 - now);
}
