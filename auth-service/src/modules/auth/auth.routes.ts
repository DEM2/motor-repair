/**
 * Rutas de autenticación.
 *
 *   POST /api/auth/login     (pública)  Inicia sesión y devuelve el JWT
 *   GET  /api/auth/me        (JWT)      Perfil del usuario autenticado
 *   POST /api/auth/register  (ADMIN)    Registra un nuevo usuario
 *
 * Decisión de diseño: la aplicación es de uso interno del taller, por lo que NO hay
 * auto-registro público; solo un administrador puede registrar usuarios.
 */
import { Router } from 'express';
import { UserRole } from '../../entities/User';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { createUserSchema } from '../users/users.schemas';
import { authController } from './auth.controller';
import { loginSchema } from './auth.schemas';

export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), authController.login);

authRouter.get('/me', authenticate, authController.me);

authRouter.post(
  '/register',
  authenticate,
  authorize(UserRole.ADMIN),
  validate({ body: createUserSchema }),
  authController.register,
);
