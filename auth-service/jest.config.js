/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Prepara variables de entorno (llaves RSA efímeras, BD de pruebas) ANTES de cargar la app.
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/database/migrate.ts'],
  testTimeout: 20000,
};
