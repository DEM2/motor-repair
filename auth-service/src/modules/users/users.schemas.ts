/**
 * Esquemas de validación (Zod) para las operaciones sobre usuarios.
 */
import { z } from 'zod';
import { UserRole } from '../../entities/User';

/** Correo normalizado: sin espacios y en minúsculas. */
export const emailSchema = z
  .string({ required_error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .email('Correo electrónico inválido')
  .max(255);

/**
 * Política de contraseñas: mínimo 8 caracteres con mayúscula, minúscula y número.
 * El máximo de 72 se debe a que bcrypt solo considera los primeros 72 bytes.
 */
export const passwordSchema = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir una letra mayúscula')
  .regex(/\d/, 'La contraseña debe incluir un número');

const fullNameSchema = z
  .string({ required_error: 'El nombre es obligatorio' })
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(120);

export const userIdParamsSchema = z.object({
  id: z.string().uuid('El id debe ser un UUID válido'),
});

export const createUserSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  password: passwordSchema,
  role: z.nativeEnum(UserRole).default(UserRole.OPERATOR),
});

/** Todos los campos son opcionales, pero se exige enviar al menos uno. */
export const updateUserSchema = z
  .object({
    email: emailSchema.optional(),
    fullName: fullNameSchema.optional(),
    password: passwordSchema.optional(),
    role: z.nativeEnum(UserRole).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Debe enviar al menos un campo para actualizar' });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
