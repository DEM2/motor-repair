/**
 * Controladores HTTP de autenticación.
 */
import type { Request, Response } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { usersService } from '../users/users.service';
import { authService } from './auth.service';

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    res.json(await authService.login(req.body));
  },

  async me(req: Request, res: Response): Promise<void> {
    res.json(await authService.me(requireAuth(req).sub));
  },

  async register(req: Request, res: Response): Promise<void> {
    const user = await usersService.create(req.body);
    res.status(201).location(`/api/users/${user.id}`).json(user);
  },
};
