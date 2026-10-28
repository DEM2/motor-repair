/**
 * Utilidades compartidas por las pruebas de integración.
 */
import { AppDataSource } from '../src/database/data-source';
import { User, UserRole } from '../src/entities/User';
import { signAccessToken } from '../src/utils/jwt';
import { hashPassword } from '../src/utils/password';

export const DEFAULT_PASSWORD = 'Secreta123';

/** Deja la base de datos de pruebas vacía y con el esquema al día. */
export async function setupDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  await AppDataSource.dropDatabase();
  await AppDataSource.runMigrations();
}

export async function clearUsers(): Promise<void> {
  await AppDataSource.query('TRUNCATE TABLE "users"');
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

interface UserOverrides {
  email?: string;
  fullName?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

/** Inserta un usuario directamente en la BD (sin pasar por la API). */
export async function createUser(overrides: UserOverrides = {}): Promise<User> {
  const repo = AppDataSource.getRepository(User);
  return repo.save(
    repo.create({
      email: overrides.email ?? `user-${Math.random().toString(36).slice(2, 10)}@taller.local`,
      fullName: overrides.fullName ?? 'Usuario de Prueba',
      passwordHash: await hashPassword(overrides.password ?? DEFAULT_PASSWORD),
      role: overrides.role ?? UserRole.OPERATOR,
      isActive: overrides.isActive ?? true,
    }),
  );
}

/** Emite un token válido para el usuario, como si hubiera iniciado sesión. */
export function bearerFor(user: User): string {
  const { accessToken } = signAccessToken({ sub: user.id, email: user.email, name: user.fullName, role: user.role });
  return `Bearer ${accessToken}`;
}
