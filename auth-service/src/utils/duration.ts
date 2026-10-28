/**
 * Convierte una duración corta ("30s", "15m", "1h", "7d") a segundos.
 * Se usa para informar al cliente cuánto dura el token (campo expiresIn de la respuesta).
 */
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error(`Duración inválida: "${value}"`);
  }
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}
