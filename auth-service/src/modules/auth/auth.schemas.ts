import { z } from 'zod';
import { emailSchema } from '../users/users.schemas';

export const loginSchema = z.object({
  email: emailSchema,
  // En el login no se aplica la política de complejidad: solo se compara con el hash.
  password: z.string({ required_error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria').max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;
