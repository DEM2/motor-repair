/**
 * Configuración del servicio a partir de variables de entorno.
 *
 * - Todas las variables se validan con Zod al arrancar: si falta algo o tiene un
 *   formato inválido, el proceso falla de inmediato ("fail fast") con un mensaje claro,
 *   en lugar de fallar más tarde en tiempo de ejecución.
 * - La llave privada RSA se carga desde un archivo (JWT_PRIVATE_KEY_PATH, usado en local
 *   y en Docker mediante secrets) o directamente desde una variable (JWT_PRIVATE_KEY,
 *   útil en CI o en gestores de secretos de la nube).
 * - La llave pública se DERIVA de la privada, de modo que este servicio puede verificar
 *   sus propios tokens sin necesitar un archivo adicional.
 */
import 'dotenv/config';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { durationToSeconds } from '../utils/duration';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),

  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PRIVATE_KEY_PATH: z.string().optional(),
  JWT_ISSUER: z.string().min(1).default('motor-repair-auth'),
  JWT_AUDIENCE: z.string().min(1).default('motor-repair-api'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'Formato esperado: número + s|m|h|d (por ejemplo 1h)')
    .default('1h'),

  // Mínimo 4 solo para acelerar las pruebas; en producción se recomienda 12.
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_FULL_NAME: z.string().min(1).default('Administrador'),
});

/** Obtiene el PEM de la llave privada desde la variable o el archivo configurado. */
function loadPrivateKeyPem(env: z.infer<typeof envSchema>): string {
  if (env.JWT_PRIVATE_KEY) {
    // Permite pasar el PEM en una sola línea con "\n" literales (típico en CI).
    return env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  if (env.JWT_PRIVATE_KEY_PATH) {
    return readFileSync(resolve(env.JWT_PRIVATE_KEY_PATH), 'utf8');
  }
  throw new Error('Debe definir JWT_PRIVATE_KEY o JWT_PRIVATE_KEY_PATH para firmar los tokens.');
}

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  const env = parsed.data;

  const privateKeyPem = loadPrivateKeyPem(env);
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error('La llave JWT debe ser RSA (algoritmo RS256).');
  }
  const publicKeyPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    db: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      name: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    jwt: {
      privateKey: privateKeyPem,
      publicKey: publicKeyPem,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_EXPIRES_IN,
      expiresInSeconds: durationToSeconds(env.JWT_EXPIRES_IN),
    },
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    admin: {
      email: env.ADMIN_EMAIL?.toLowerCase(),
      password: env.ADMIN_PASSWORD,
      fullName: env.ADMIN_FULL_NAME,
    },
  });
}

export const config = loadConfig();
export type AppConfig = typeof config;
