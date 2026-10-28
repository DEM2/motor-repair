/**
 * Ejecuta las migraciones pendientes y el seed del administrador, y termina.
 * Uso:  npm run migrate        (código compilado)
 *       npm run migrate:dev    (TypeScript directo)
 */
import { AppDataSource } from './data-source';
import { ensureAdminUser } from './seed';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const applied = await AppDataSource.runMigrations({ transaction: 'each' });
  console.log(`[migrate] Migraciones aplicadas: ${applied.length}`);
  await ensureAdminUser();
  await AppDataSource.destroy();
}

main().catch((error) => {
  console.error('[migrate] Error:', error);
  process.exit(1);
});
