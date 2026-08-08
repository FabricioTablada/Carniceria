/**
 * modules/batches/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de Lotes (Bloque LOTES-01).
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `service.ts`).
 *
 * Sin `CreateBatchSchema`: no existe `POST /batches` en este bloque (ver
 * `routes.ts`) -- la creacion automatica desde Compras (LOTES-02) construye
 * su `CreateBatchDto` internamente en codigo, nunca a partir de un body de
 * peticion HTTP, asi que no hay ningun body que validar todavia. Se agrega
 * cuando exista ese endpoint.
 */
import { z } from 'zod';

/** Estados soportados (enum `BatchStatus` de `schema.prisma`). */
const BatchStatusSchema = z.enum(['ACTIVE', 'DEPLETED', 'EXPIRED', 'BLOCKED']);

/** Validacion del cuerpo de la peticion de ajuste de un lote
 * (`PATCH /batches/:id`). */
export const UpdateBatchSchema = z.object({
  availableQuantity: z
    .number()
    .min(0, 'La cantidad disponible no puede ser negativa.')
    .optional(),
  status: BatchStatusSchema.optional(),
  notes: z.string().nullish(),
});

export type UpdateBatchDto = z.infer<typeof UpdateBatchSchema>;

/** Validacion de los query params para el listado de lotes. */
export const ListBatchQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  productId: z.string().uuid('El producto debe ser un identificador valido.').optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  supplierId: z.string().uuid('El proveedor debe ser un identificador valido.').optional(),
  status: BatchStatusSchema.optional(),
});

export type ListBatchQueryDto = z.infer<typeof ListBatchQuerySchema>;
