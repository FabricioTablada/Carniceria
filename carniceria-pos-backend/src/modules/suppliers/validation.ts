/**
 * modules/suppliers/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de proveedores.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `suppliers.service.ts`).
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de creacion de proveedor. */
export const CreateSupplierSchema = z.object({
  name: z
    .string({ required_error: 'El nombre del proveedor es obligatorio.' })
    .min(3, 'El nombre del proveedor debe tener al menos 3 caracteres.'),
  legalId: z.string().nullish(),
  contactName: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email('El correo electronico no es valido.').nullish(),
  address: z.string().nullish(),
  active: z.boolean().optional(),
});

export type CreateSupplierDto = z.infer<typeof CreateSupplierSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de proveedor. */
export const UpdateSupplierSchema = z.object({
  name: z.string().min(3, 'El nombre del proveedor debe tener al menos 3 caracteres.').optional(),
  legalId: z.string().nullish(),
  contactName: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email('El correo electronico no es valido.').nullish(),
  address: z.string().nullish(),
});

export type UpdateSupplierDto = z.infer<typeof UpdateSupplierSchema>;

/** Validacion de los query params para el listado de proveedores. */
export const ListSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  search: z.string().optional(),
});

export type ListSuppliersQueryDto = z.infer<typeof ListSuppliersQuerySchema>;

/** Validacion de los query params para el lookup (selector) de proveedores.
 * Arquitectura de selectores, Bloque 1: sin `page` (el lookup no es una
 * tabla paginable, ver `shared/utils/lookup.ts`). */
export const LookupSuppliersQuerySchema = z.object({
  search: z.string().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type LookupSuppliersQueryDto = z.infer<typeof LookupSuppliersQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de proveedor. */
export const ChangeSupplierStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeSupplierStatusDto = z.infer<typeof ChangeSupplierStatusSchema>;
