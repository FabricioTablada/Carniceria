/**
 * modules/inventory/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de inventario.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `inventory.service.ts`).
 *
 * NOTA: el modelo `Inventory` no tiene campo `active`, por lo que no existe
 * un esquema de cambio de estado en este modulo.
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de creacion de inventario. */
export const CreateInventorySchema = z.object({
  sucursalId: z
    .string({ required_error: 'La sucursal es obligatoria.' })
    .uuid('La sucursal debe ser un identificador valido.'),
  productId: z
    .string({ required_error: 'El producto es obligatorio.' })
    .uuid('El producto debe ser un identificador valido.'),
  quantity: z.number().min(0, 'La cantidad debe ser mayor o igual a 0.').optional(),
  reorderPoint: z.number().min(0, 'El punto de reorden debe ser mayor o igual a 0.').nullish(),
});

export type CreateInventoryDto = z.infer<typeof CreateInventorySchema>;

/** Validacion del cuerpo de la peticion de actualizacion de inventario. */
export const UpdateInventorySchema = z.object({
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  productId: z.string().uuid('El producto debe ser un identificador valido.').optional(),
  quantity: z.number().min(0, 'La cantidad debe ser mayor o igual a 0.').optional(),
  reorderPoint: z.number().min(0, 'El punto de reorden debe ser mayor o igual a 0.').nullish(),
});

export type UpdateInventoryDto = z.infer<typeof UpdateInventorySchema>;

/** Validacion de los query params para el listado de inventario. */
export const ListInventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  productId: z.string().uuid('El producto debe ser un identificador valido.').optional(),
  // Bloque 7.29A: busqueda por nombre/SKU/codigo de barras del producto
  // asociado -- mismo esquema (`z.string().optional()`) que `search` en
  // `products.validation.ts`.
  search: z.string().optional(),
});

export type ListInventoryQueryDto = z.infer<typeof ListInventoryQuerySchema>;
