/**
 * Crea el usuario administrador inicial si no existe.
 *
 * Sin este paso nadie podría iniciar sesión la primera vez, porque el registro de
 * usuarios está restringido a administradores. Las credenciales vienen de las
 * variables ADMIN_EMAIL y ADMIN_PASSWORD (nunca están escritas en el código).
 * Es idempotente: se puede ejecutar en cada arranque sin duplicar datos.
 */
import { config } from '../config/env';
import { User, UserRole } from '../entities/User';
import { hashPassword } from '../utils/password';
import { AppDataSource } from './data-source';

export async function ensureAdminUser(): Promise<void> {
  const { email, password, fullName } = config.admin;
  if (!email || !password) {
    console.warn('[seed] ADMIN_EMAIL/ADMIN_PASSWORD no definidos: no se crea el administrador inicial.');
    return;
  }

  const repo = AppDataSource.getRepository(User);
  if (await repo.existsBy({ email })) {
    return;
  }

  await repo.save(
    repo.create({
      email,
      fullName,
      passwordHash: await hashPassword(password),
      role: UserRole.ADMIN,
      isActive: true,
    }),
  );
  console.log(`[seed] Administrador inicial creado: ${email}`);
}
