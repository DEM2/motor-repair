/**
 * Controladores HTTP de usuarios: traducen la petición HTTP a llamadas del servicio
 * y el resultado a una respuesta HTTP. No contienen reglas de negocio.
 */
import type { Request, Response } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { Errors } from '../../utils/http-error';
import { UserRole } from '../../entities/User';
import { usersService } from './users.service';

type IdParams = { id: string };

export const usersController = {
  async list(_req: Request, res: Response): Promise<void> {
    res.json(await usersService.list());
  },

  /** Un ADMIN puede ver a cualquiera; un OPERATOR solo a sí mismo. */
  async getById(req: Request<IdParams>, res: Response): Promise<void> {
    const actor = requireAuth(req);
    if (actor.role !== UserRole.ADMIN && actor.sub !== req.params.id) {
      throw Errors.forbidden();
    }
    res.json(await usersService.getById(req.params.id));
  },

  async update(req: Request<IdParams>, res: Response): Promise<void> {
    res.json(await usersService.update(req.params.id, req.body, requireAuth(req)));
  },

  async deactivate(req: Request<IdParams>, res: Response): Promise<void> {
    res.json(await usersService.setActive(req.params.id, false, requireAuth(req)));
  },

  async activate(req: Request<IdParams>, res: Response): Promise<void> {
    res.json(await usersService.setActive(req.params.id, true, requireAuth(req)));
  },
};
