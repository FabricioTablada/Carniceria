/**
 * modules/taxes/taxes.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de impuestos.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `taxes.service.ts`).
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de creacion de impuesto. */
export const CreateTaxSchema = z.object({
  code: z
    .string({ required_error: 'El codigo del impuesto es obligatorio.' })
    .min(2, 'El codigo del impuesto debe tener al menos 2 caracteres.'),
  name: z
    .string({ required_error: 'El nombre del impuesto es obligatorio.' })
    .min(3, 'El nombre del impuesto debe tener al menos 3 caracteres.'),
  rate: z
    .number({ required_error: 'La tasa del impuesto es obligatoria.' })
    .min(0, 'La tasa del impuesto debe ser mayor o igual a 0.'),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export type CreateTaxDto = z.infer<typeof CreateTaxSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de impuesto. */
export const UpdateTaxSchema = z.object({
  code: z.string().min(2, 'El codigo del impuesto debe tener al menos 2 caracteres.').optional(),
  name: z.string().min(3, 'El nombre del impuesto debe tener al menos 3 caracteres.').optional(),
  rate: z.number().min(0, 'La tasa del impuesto debe ser mayor o igual a 0.').optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateTaxDto = z.infer<typeof UpdateTaxSchema>;

/** Validacion de los query params para el listado de impuestos. */
export const ListTaxesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  isDefault: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  search: z.string().optional(),
});

export type ListTaxesQueryDto = z.infer<typeof ListTaxesQuerySchema>;

/** Validacion de los query params para el lookup (selector) de impuestos.
 * Arquitectura de selectores, Bloque 1: sin `page` (el lookup no es una
 * tabla paginable, ver `shared/utils/lookup.ts`). */
export const LookupTaxesQuerySchema = z.object({
  search: z.string().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type LookupTaxesQueryDto = z.infer<typeof LookupTaxesQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de impuesto. */
export const ChangeTaxStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeTaxStatusDto = z.infer<typeof ChangeTaxStatusSchema>;
