import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  ChangeRoleStatusDto,
  CreateRoleDto,
  UpdateRoleDto,
} from '../types/role.types'

/**
 * Replica exacta de `CreateRoleSchema` (modules/roles/roles.validation.ts,
 * backend). Mismos campos, mismas reglas, mismos mensajes. El backend usa
 * `required_error` (Zod v3); este proyecto usa Zod v4 (ver package.json),
 * donde ese estilo de opciones ya no existe, asi que el caracter
 * "obligatorio" del campo se expresa con `.min(1, mensaje)` en vez de
 * `required_error` — la regla de validacion es identica, solo cambia la
 * sintaxis de la API de Zod entre versiones. Mismo criterio ya usado en
 * `features/users/schemas/user.schema.ts`.
 */
export const createRoleSchema: z.ZodType<CreateRoleDto> = z.object({
  name: z
    .string()
    .min(1, 'El nombre del rol es obligatorio.')
    .min(3, 'El nombre del rol debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
  permissionIds: z
    .array(z.string().regex(UUID_REGEX, 'Cada permiso debe ser un identificador valido.'))
    .optional(),
  active: z.boolean().optional(),
})

/**
 * Replica exacta de `UpdateRoleSchema` (backend): mismos campos que
 * `createRoleSchema`, todos opcionales, sin `active` (el backend maneja el
 * cambio de estado por separado, en `changeRoleStatusSchema`).
 */
export const updateRoleSchema: z.ZodType<UpdateRoleDto> = z.object({
  name: z
    .string()
    .min(3, 'El nombre del rol debe tener al menos 3 caracteres.')
    .optional(),
  description: z.string().nullish(),
  permissionIds: z
    .array(z.string().regex(UUID_REGEX, 'Cada permiso debe ser un identificador valido.'))
    .optional(),
})

/** Replica exacta de `ChangeRoleStatusSchema` (backend). */
export const changeRoleStatusSchema: z.ZodType<ChangeRoleStatusDto> = z.object({
  active: z.boolean('El estado activo es obligatorio.'),
})