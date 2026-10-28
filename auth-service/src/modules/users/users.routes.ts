/**
 * Rutas de administración de usuarios. Todas requieren un JWT válido.
 *
 *   GET    /api/users                 (ADMIN)          Listar usuarios
 *   GET    /api/users/:id             (ADMIN o propio)  Consultar un usuario
 *   PATCH  /api/users/:id             (ADMIN o propio)  Actualizar datos
 *   PATCH  /api/users/:id/deactivate  (ADMIN)          Desactivar
 *   PATCH  /api/users/:id/activate    (ADMIN)          Reactivar
 *
 * El registro de usuarios está en POST /api/auth/register (ver auth.routes.ts).
 */
import { Router } from 'express';
import { UserRole } from '../../entities/User';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { usersController } from './users.controller';
import { updateUserSchema, userIdParamsSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', authorize(UserRole.ADMIN), usersController.list);

usersRouter.get('/:id', validate({ params: userIdParamsSchema }), usersController.getById);

usersRouter.patch(
  '/:id',
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  usersController.update,
);

usersRouter.patch(
  '/:id/deactivate',
  authorize(UserRole.ADMIN),
  validate({ params: userIdParamsSchema }),
  usersController.deactivate,
);

usersRouter.patch(
  '/:id/activate',
  authorize(UserRole.ADMIN),
  validate({ params: userIdParamsSchema }),
  usersController.activate,
);
