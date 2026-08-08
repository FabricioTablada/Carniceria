/**
 * modules/permissions/permissions.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de permisos.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `permissions.service.ts`).
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de creacion de permiso. */
export const CreatePermissionSchema = z.object({
  code: z
    .string({ required_error: 'El codigo del permiso es obligatorio.' })
    .min(3, 'El codigo del permiso debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
});

export type CreatePermissionDto = z.infer<typeof CreatePermissionSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de permiso. */
export const UpdatePermissionSchema = z.object({
  code: z.string().min(3, 'El codigo del permiso debe tener al menos 3 caracteres.').optional(),
  description: z.string().nullish(),
});

export type UpdatePermissionDto = z.infer<typeof UpdatePermissionSchema>;

/** Validacion de los query params para el listado de permisos. */
export const ListPermissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
});

export type ListPermissionsQueryDto = z.infer<typeof ListPermissionsQuerySchema>;
