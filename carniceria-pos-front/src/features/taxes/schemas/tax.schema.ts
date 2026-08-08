import { z } from 'zod'
import type {
  ChangeTaxStatusDto,
  CreateTaxDto,
  UpdateTaxDto,
} from '../types/tax.types'

/**
 * Replica exacta de `CreateTaxSchema`
 * (modules/taxes/taxes.validation.ts, backend). Mismos campos, mismas
 * reglas, mismos mensajes. El backend usa `required_error` (Zod v3); este
 * proyecto usa Zod v4 (ver package.json), donde ese estilo de opciones ya
 * no existe, asi que el caracter "obligatorio" del campo se expresa con
 * `.min(1, mensaje)` en vez de `required_error` — la regla de validacion
 * es identica, solo cambia la sintaxis de la API de Zod entre versiones.
 * Mismo criterio ya usado en `category.schema.ts`, `product.schema.ts`,
 * `user.schema.ts` y `role.schema.ts`.
 */
export const createTaxSchema: z.ZodType<CreateTaxDto> = z.object({
  code: z
    .string()
    .min(1, 'El codigo del impuesto es obligatorio.')
    .min(2, 'El codigo del impuesto debe tener al menos 2 caracteres.'),
  name: z
    .string()
    .min(1, 'El nombre del impuesto es obligatorio.')
    .min(3, 'El nombre del impuesto debe tener al menos 3 caracteres.'),
  rate: z
    .number('La tasa del impuesto es obligatoria.')
    .min(0, 'La tasa del impuesto debe ser mayor o igual a 0.'),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
})

/**
 * Replica exacta de `UpdateTaxSchema` (backend): mismos campos que
 * `createTaxSchema`, todos opcionales, sin `active` (el backend maneja el
 * cambio de estado por separado, en `changeTaxStatusSchema`).
 */
export const updateTaxSchema: z.ZodType<UpdateTaxDto> = z.object({
  code: z
    .string()
    .min(2, 'El codigo del impuesto debe tener al menos 2 caracteres.')
    .optional(),
  name: z
    .string()
    .min(3, 'El nombre del impuesto debe tener al menos 3 caracteres.')
    .optional(),
  rate: z
    .number()
    .min(0, 'La tasa del impuesto debe ser mayor o igual a 0.')
    .optional(),
  isDefault: z.boolean().optional(),
})

/** Replica exacta de `ChangeTaxStatusSchema` (backend). */
export const changeTaxStatusSchema: z.ZodType<ChangeTaxStatusDto> = z.object({
  active: z.boolean('El estado activo es obligatorio.'),
})