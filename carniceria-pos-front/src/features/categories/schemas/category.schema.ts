import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  ChangeCategoryStatusDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../types/category.types'

/**
 * Replica exacta de `CreateCategorySchema`
 * (modules/categories/categories.validation.ts, backend). Mismos campos,
 * mismas reglas, mismos mensajes. El backend usa `required_error` (Zod
 * v3); este proyecto usa Zod v4 (ver package.json), donde ese estilo de
 * opciones ya no existe, asi que el caracter "obligatorio" del campo se
 * expresa con `.min(1, mensaje)` en vez de `required_error` — la regla de
 * validacion es identica, solo cambia la sintaxis de la API de Zod entre
 * versiones. Mismo criterio ya usado en `user.schema.ts`, `role.schema.ts`
 * y `product.schema.ts`.
 */
/** Replica exacta de la validacion de color del backend
 * (`categoryColorSchema`, `categories.validation.ts`): hex de 6 digitos
 * (ej. `#3B82F6`). `nullish()`: opcional, `null` = sin color propio. */
const categoryColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un hexadecimal valido (ej. #3B82F6).')
  .nullish()

export const createCategorySchema: z.ZodType<CreateCategoryDto> = z.object({
  name: z
    .string()
    .min(1, 'El nombre de la categoria es obligatorio.')
    .min(3, 'El nombre de la categoria debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
  color: categoryColorSchema,
  parentId: z
    .string()
    .regex(UUID_REGEX, 'La categoria padre debe ser un identificador valido.')
    .nullish(),
  active: z.boolean().optional(),
})

/**
 * Replica exacta de `UpdateCategorySchema` (backend): mismos campos que
 * `createCategorySchema`, todos opcionales, sin `active` (el backend
 * maneja el cambio de estado por separado, en
 * `changeCategoryStatusSchema`).
 */
export const updateCategorySchema: z.ZodType<UpdateCategoryDto> = z.object({
  name: z
    .string()
    .min(3, 'El nombre de la categoria debe tener al menos 3 caracteres.')
    .optional(),
  description: z.string().nullish(),
  color: categoryColorSchema,
  parentId: z
    .string()
    .regex(UUID_REGEX, 'La categoria padre debe ser un identificador valido.')
    .nullish(),
})

/** Replica exacta de `ChangeCategoryStatusSchema` (backend). */
export const changeCategoryStatusSchema: z.ZodType<ChangeCategoryStatusDto> =
  z.object({
    active: z.boolean('El estado activo es obligatorio.'),
  })