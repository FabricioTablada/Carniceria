import { z } from 'zod'
import type {
  CreatePermissionDto,
  UpdatePermissionDto,
} from '../types/permission.types'

export const createPermissionSchema: z.ZodType<CreatePermissionDto> = z.object({
  code: z
    .string()
    .min(1, 'El código del permiso es obligatorio.')
    .min(3, 'El código del permiso debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
})

export const updatePermissionSchema: z.ZodType<UpdatePermissionDto> = z.object({
  code: z
    .string()
    .min(3, 'El código del permiso debe tener al menos 3 caracteres.')
    .optional(),
  description: z.string().nullish(),
})