/**
 * Lógica de autenticación: validación de credenciales y emisión del JWT.
 */
import { AppDataSource } from '../../database/data-source';
import { User, toPublicUser, type PublicUser } from '../../entities/User';
import { Errors, HttpError } from '../../utils/http-error';
import { signAccessToken, type IssuedToken } from '../../utils/jwt';
import { simulatePasswordCheck, verifyPassword } from '../../utils/password';
import type { LoginInput } from './auth.schemas';

export interface LoginResult extends IssuedToken {
  user: PublicUser;
}

/** Mensaje idéntico para correo inexistente y contraseña errónea: no revela qué falló. */
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';

export const authService = {
  async login({ email, password }: LoginInput): Promise<LoginResult> {
    const repo = AppDataSource.getRepository(User);

    // passwordHash tiene select:false, por eso se pide explícitamente.
    const user = await repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      await simulatePasswordCheck(password);
      throw Errors.unauthorized(INVALID_CREDENTIALS);
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      throw Errors.unauthorized(INVALID_CREDENTIALS);
    }

    // Se informa la desactivación solo DESPUÉS de validar la contraseña,
    // para no revelar el estado de cuentas ajenas.
    if (!user.isActive) {
      throw new HttpError(403, 'USER_INACTIVE', 'El usuario está desactivado. Contacte al administrador');
    }

    user.lastLoginAt = new Date();
    await repo.update({ id: user.id }, { lastLoginAt: user.lastLoginAt });

    const token = signAccessToken({ sub: user.id, email: user.email, name: user.fullName, role: user.role });
    return { ...token, user: toPublicUser(user) };
  },

  /**
   * Perfil del usuario autenticado. Se consulta la BD (y no solo el token) para
   * reflejar cambios recientes y rechazar a usuarios desactivados.
   */
  async me(userId: string): Promise<PublicUser> {
    const user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
    if (!user || !user.isActive) {
      throw Errors.unauthorized('El usuario no existe o está desactivado');
    }
    return toPublicUser(user);
  },
};
