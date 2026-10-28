/**
 * Hash y verificación de contraseñas con bcrypt.
 *
 * bcrypt es un algoritmo de hash adaptativo: incluye una sal aleatoria por contraseña
 * (evita tablas arcoíris) y un factor de costo configurable (BCRYPT_SALT_ROUNDS) que
 * lo hace deliberadamente lento para frenar ataques de fuerza bruta.
 * Nunca se almacena ni se registra la contraseña en texto plano.
 */
import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Hash ficticio usado cuando el correo no existe. Comparar contra él hace que el
 * tiempo de respuesta sea similar exista o no el usuario, lo que dificulta descubrir
 * qué correos están registrados midiendo tiempos (enumeración de usuarios).
 */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export async function simulatePasswordCheck(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}
