/**
 * Punto de entrada del servicio.
 *
 * Al arrancar: 1) conecta a la BD, 2) aplica migraciones pendientes,
 * 3) crea el administrador inicial si no existe y 4) escucha peticiones HTTP.
 * Maneja SIGTERM/SIGINT para cerrar conexiones de forma ordenada (importante en Docker).
 */
import { createApp } from './app';
import { config } from './config/env';
import { AppDataSource } from './database/data-source';
import { ensureAdminUser } from './database/seed';

async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();
  const applied = await AppDataSource.runMigrations({ transaction: 'each' });
  if (applied.length > 0) {
    console.log(`[db] Migraciones aplicadas: ${applied.map((m) => m.name).join(', ')}`);
  }
  await ensureAdminUser();

  const server = createApp().listen(config.port, () => {
    console.log(`[auth-service] Escuchando en http://localhost:${config.port} (docs: /docs)`);
  });

  const shutdown = (signal: string) => {
    console.log(`[auth-service] ${signal} recibido, cerrando...`);
    server.close(async () => {
      await AppDataSource.destroy();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('[auth-service] No se pudo iniciar:', error);
  process.exit(1);
});
