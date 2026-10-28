/**
 * Lógica de negocio de usuarios: registro, consulta, actualización y (des)activación.
 *
 * Los controladores no acceden directamente a la base de datos: delegan en este servicio,
 * que a su vez usa el repositorio de TypeORM.
 */
import { AppDataSource } from '../../database/data-source';
import { User, UserRole, toPublicUser, type PublicUser } from '../../entities/User';
import { Errors } from '../../utils/http-error';
import type { AccessTokenClaims } from '../../utils/jwt';
import { hashPassword } from '../../utils/password';
import type { CreateUserInput, UpdateUserInput } from './users.schemas';

const repo = () => AppDataSource.getRepository(User);

async function findEntityOrFail(id: string): Promise<User> {
  const user = await repo().findOneBy({ id });
  if (!user) {
    throw Errors.notFound('Usuario no encontrado');
  }
  return user;
}

async function assertEmailAvailable(email: string, excludeId?: string): Promise<void> {
  const existing = await repo().findOneBy({ email });
  if (existing && existing.id !== excludeId) {
    throw Errors.conflict(`Ya existe un usuario con el correo ${email}`);
  }
}

export const usersService = {
  async create(input: CreateUserInput): Promise<PublicUser> {
    await assertEmailAvailable(input.email);
    const user = repo().create({
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      isActive: true,
    });
    return toPublicUser(await repo().save(user));
  },

  async list(): Promise<PublicUser[]> {
    const users = await repo().find({ order: { createdAt: 'ASC' } });
    return users.map(toPublicUser);
  },

  async getById(id: string): Promise<PublicUser> {
    return toPublicUser(await findEntityOrFail(id));
  },

  /**
   * Reglas:
   *  - Un ADMIN puede actualizar a cualquier usuario.
   *  - Un OPERATOR solo puede actualizar su propio nombre, correo y contraseña.
   *  - Nadie puede quitarse a sí mismo el rol ADMIN (evita quedar sin administradores).
   */
  async update(id: string, input: UpdateUserInput, actor: AccessTokenClaims): Promise<PublicUser> {
    const isSelf = actor.sub === id;
    const isAdmin = actor.role === UserRole.ADMIN;

    if (!isAdmin && !isSelf) {
      throw Errors.forbidden();
    }
    if (!isAdmin && input.role !== undefined) {
      throw Errors.forbidden('Solo un administrador puede cambiar roles');
    }
    if (isSelf && isAdmin && input.role !== undefined && input.role !== UserRole.ADMIN) {
      throw Errors.badRequest('No puede quitarse a sí mismo el rol de administrador');
    }

    const user = await findEntityOrFail(id);

    if (input.email !== undefined && input.email !== user.email) {
      await assertEmailAvailable(input.email, id);
      user.email = input.email;
    }
    if (input.fullName !== undefined) user.fullName = input.fullName;
    if (input.role !== undefined) user.role = input.role;
    if (input.password !== undefined) user.passwordHash = await hashPassword(input.password);

    return toPublicUser(await repo().save(user));
  },

  /** Activa o desactiva (borrado lógico) un usuario. Solo ADMIN, y nunca sobre sí mismo. */
  async setActive(id: string, isActive: boolean, actor: AccessTokenClaims): Promise<PublicUser> {
    if (actor.sub === id && !isActive) {
      throw Errors.badRequest('No puede desactivar su propio usuario');
    }
    const user = await findEntityOrFail(id);
    user.isActive = isActive;
    return toPublicUser(await repo().save(user));
  },
};
