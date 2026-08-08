/**
 * modules/roles/roles.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de roles.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `roles.service.ts`).
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de creacion de rol. */
export const CreateRoleSchema = z.object({
  name: z
    .string({ required_error: 'El nombre del rol es obligatorio.' })
    .min(3, 'El nombre del rol debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
  permissionIds: z
    .array(z.string().uuid('Cada permiso debe ser un identificador valido.'))
    .optional(),
  active: z.boolean().optional(),
});

export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de rol. */
export const UpdateRoleSchema = z.object({
  name: z.string().min(3, 'El nombre del rol debe tener al menos 3 caracteres.').optional(),
  description: z.string().nullish(),
  permissionIds: z
    .array(z.string().uuid('Cada permiso debe ser un identificador valido.'))
    .optional(),
});

export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;

/** Validacion de los query params para el listado de roles. */
export const ListRolesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  isSystem: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  search: z.string().optional(),
});

export type ListRolesQueryDto = z.infer<typeof ListRolesQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de rol. */
export const ChangeRoleStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeRoleStatusDto = z.infer<typeof ChangeRoleStatusSchema>;

/** Validacion del cuerpo de la peticion de asignacion de permisos a un rol. */
export const AssignRolePermissionsSchema = z.object({
  permissionIds: z
    .array(z.string().uuid('Cada permiso debe ser un identificador valido.'), {
      required_error: 'La lista de permisos es obligatoria.',
    })
    .min(1, 'Debe incluir al menos un permiso.'),
});

export type AssignRolePermissionsDto = z.infer<typeof AssignRolePermissionsSchema>;