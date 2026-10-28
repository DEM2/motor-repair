/**
 * Se ejecuta antes de cada archivo de pruebas (jest "setupFiles").
 *
 * - Genera un par de llaves RSA EFÍMERO: las pruebas nunca dependen de llaves reales.
 * - Apunta a una base de datos de pruebas separada (TEST_DB_*), que se reinicia
 *   en cada suite. En CI la provee un contenedor de PostgreSQL de GitHub Actions.
 */
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_HOST: process.env.TEST_DB_HOST ?? 'localhost',
  DB_PORT: process.env.TEST_DB_PORT ?? '5432',
  DB_NAME: process.env.TEST_DB_NAME ?? 'auth_test',
  DB_USER: process.env.TEST_DB_USER ?? 'postgres',
  DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? 'postgres',
  JWT_PRIVATE_KEY: privateKey,
  JWT_ISSUER: 'motor-repair-auth',
  JWT_AUDIENCE: 'motor-repair-api',
  JWT_EXPIRES_IN: '1h',
  BCRYPT_SALT_ROUNDS: '4',
  CORS_ORIGINS: 'http://localhost:5173',
});
// Las pruebas no deben depender de un archivo de llaves ni crear el administrador inicial.
delete process.env.JWT_PRIVATE_KEY_PATH;
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
