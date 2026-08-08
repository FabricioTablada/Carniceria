/**
 * modules/categories/categories.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de categorias.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `categories.service.ts`).
 */
import { z } from 'zod';

/** Color hexadecimal de 6 digitos (ej. "#3B82F6") — mismo formato que ya
 * usan los tokens de color del frontend. `nullish()`: el color es
 * opcional, `null` = sin color propio (compatibilidad con categorias
 * existentes, el frontend resuelve un color deterministico por `id`). */
const categoryColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un hexadecimal valido (ej. #3B82F6).')
  .nullish();

/** Validacion del cuerpo de la peticion de creacion de categoria. */
export const CreateCategorySchema = z.object({
  name: z
    .string({ required_error: 'El nombre de la categoria es obligatorio.' })
    .min(3, 'El nombre de la categoria debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
  color: categoryColorSchema,
  parentId: z.string().uuid('La categoria padre debe ser un identificador valido.').nullish(),
  active: z.boolean().optional(),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;

/** Validacion del cuerpo de la peticion de actualizacion de categoria. */
export const UpdateCategorySchema = z.object({
  name: z.string().min(3, 'El nombre de la categoria debe tener al menos 3 caracteres.').optional(),
  description: z.string().nullish(),
  color: categoryColorSchema,
  parentId: z.string().uuid('La categoria padre debe ser un identificador valido.').nullish(),
});

export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;

/** Validacion de los query params para el listado de categorias. */
export const ListCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  parentId: z.string().uuid('La categoria padre debe ser un identificador valido.').nullish(),
  // `z.coerce.boolean()` hace `Boolean(valor)` internamente: como
  // `req.query.active` siempre llega como string desde Express,
  // `Boolean("false")` da `true` (cualquier string no vacio es truthy).
  // Con `z.coerce.boolean()`, el filtro "Inactivos" (`?active=false`)
  // terminaba consultando `active: true`, igual que "Activos". Se
  // reemplaza por un enum explicito que solo acepta los strings reales
  // que puede mandar el cliente y los mapea al boolean correcto.
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  search: z.string().optional(),
});

export type ListCategoriesQueryDto = z.infer<typeof ListCategoriesQuerySchema>;

/** Validacion de los query params para el lookup (selector) de categorias.
 * Arquitectura de selectores, Bloque 1: sin `page` (el lookup no es una
 * tabla paginable, ver `shared/utils/lookup.ts`). */
export const LookupCategoriesQuerySchema = z.object({
  search: z.string().optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type LookupCategoriesQueryDto = z.infer<typeof LookupCategoriesQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de categoria. */
export const ChangeCategoryStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeCategoryStatusDto = z.infer<typeof ChangeCategoryStatusSchema>;
