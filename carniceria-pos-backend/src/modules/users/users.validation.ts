/**
 * modules/users/users.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de usuarios.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `users.service.ts`).
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de creacion de usuario.
 * `sucursalId` NO se acepta del cliente: se resuelve desde `req.user` en
 * `users.controller.ts`, adjuntado por `authenticate.middleware.ts` a
 * partir del JWT. Mismo criterio ya aplicado en
 * `purchases/validation.ts` (`CreatePurchaseSchema`). */
export const CreateUserSchema = z.object({
  roleId: z
    .string({ required_error: 'El rol es obligatorio.' })
    .uuid('El rol debe ser un identificador valido.'),
  username: z
    .string({ required_error: 'El nombre de usuario es obligatorio.' })
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email('El correo electronico no es valido.').nullish(),
  fullName: z
    .string({ required_error: 'El nombre completo es obligatorio.' })
    .min(3, 'El nombre completo debe tener al menos 3 caracteres.'),
  password: z
    .string({ required_error: 'La contrasena es obligatoria.' })
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'La contrasena debe tener al menos una letra mayuscula.')
    .regex(/[a-z]/, 'La contrasena debe tener al menos una letra minuscula.')
    .regex(/[0-9]/, 'La contrasena debe tener al menos un numero.'),
  active: z.boolean().optional(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de usuario. */
export const UpdateUserSchema = z.object({
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  roleId: z.string().uuid('El rol debe ser un identificador valido.').optional(),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.').optional(),
  email: z.string().email('El correo electronico no es valido.').nullish(),
  fullName: z.string().min(3, 'El nombre completo debe tener al menos 3 caracteres.').optional(),
  password: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'La contrasena debe tener al menos una letra mayuscula.')
    .regex(/[a-z]/, 'La contrasena debe tener al menos una letra minuscula.')
    .regex(/[0-9]/, 'La contrasena debe tener al menos un numero.')
    .optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

/** Validacion de los query params para el listado de usuarios. */
export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  roleId: z.string().uuid('El rol debe ser un identificador valido.').optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  search: z.string().optional(),
});

export type ListUsersQueryDto = z.infer<typeof ListUsersQuerySchema>;

/** Validacion de los query params para el lookup (selector) de usuarios.
 * Arquitectura de selectores, Bloque 1: sin `page` (el lookup no es una
 * tabla paginable, ver `shared/utils/lookup.ts`). */
export const LookupUsersQuerySchema = z.object({
  search: z.string().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type LookupUsersQueryDto = z.infer<typeof LookupUsersQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de usuario. */
export const ChangeUserStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeUserStatusDto = z.infer<typeof ChangeUserStatusSchema>;