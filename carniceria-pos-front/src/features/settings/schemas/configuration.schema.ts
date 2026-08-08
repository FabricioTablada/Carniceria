import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  ConfigurationValueType,
  CreateConfigurationDto,
  UpdateConfigurationDto,
} from '../types/configuration.types'

/**
 * features/settings/schemas/configuration.schema.ts
 * -----------------------------------------------------------------------------
 * Replica exacta de `CreateConfigurationSchema`/`UpdateConfigurationSchema`
 * (modules/configuration/validation.ts, backend). El backend usa Zod v3
 * (`required_error`); este proyecto usa Zod v4 (ver package.json), donde
 * ese estilo de opciones ya no existe, asi que el caracter "obligatorio"
 * de cada campo se expresa con `.min(1, mensaje)` (strings) en vez de
 * `required_error` — la regla de validacion es identica, solo cambia la
 * sintaxis de la API de Zod entre versiones. Mismo criterio ya usado en
 * `purchase.schema.ts`/`inventory.schema.ts`/`cashSession.schema.ts`.
 */

const CONFIGURATION_VALUE_TYPES: readonly ConfigurationValueType[] = [
  'string',
  'number',
  'boolean',
  'json',
]

export const createConfigurationSchema: z.ZodType<CreateConfigurationDto> = z.object({
  key: z.string().min(1, 'La clave es obligatoria.'),
  value: z.string().min(1, 'El valor es obligatorio.'),
  type: z.enum(CONFIGURATION_VALUE_TYPES).optional(),
  description: z.string().nullish(),
})

export const updateConfigurationSchema: z.ZodType<UpdateConfigurationDto> = z.object({
  sucursalId: z
    .string()
    .regex(UUID_REGEX, 'La sucursal debe ser un identificador valido.')
    .optional(),
  key: z.string().min(1, 'La clave es obligatoria.').optional(),
  value: z.string().min(1, 'El valor es obligatorio.').optional(),
  type: z.enum(CONFIGURATION_VALUE_TYPES).optional(),
  description: z.string().nullish(),
})