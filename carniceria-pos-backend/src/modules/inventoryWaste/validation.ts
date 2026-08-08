/**
 * modules/inventoryWaste/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) del modulo de Mermas (Bloque 5.2 —
 * infraestructura base). Define la forma y las reglas de los datos de
 * entrada; NO contiene logica de negocio (validar que la cantidad a
 * mermar no supere el stock disponible requiere leer la base de datos —
 * eso vivira en `inventoryWaste.service.ts`, todavia sin implementar).
 *
 * Mismo criterio que `returns/validation.ts`: `performedByUserId` no se
 * valida aqui — viajaria por `req.user`, nunca por el body.
 */
import { z } from 'zod';

/** Origenes soportados (enum `WasteReason` de `schema.prisma`). Misma
 * lista que `types.ts`. */
const WasteReasonSchema = z.enum([
  'RETURNED_NOT_RESTOCKED',
  'EXPIRED',
  'DAMAGED',
  'PRODUCTION_ERROR',
  'CUTTING_ERROR',
  'PACKAGING_ERROR',
  'COLD_CHAIN_FAILURE',
  'OTHER',
]);

/**
 * Validacion del cuerpo de la peticion de creacion de merma. `notes` es
 * obligatorio cuando `reason` es `OTHER` (sin un origen catalogado, la
 * nota es la unica forma de saber que paso — mismo criterio de
 * justificacion obligatoria ya usado en `VoidSaleSchema`/
 * `CreateSaleReturnSchema`, aplicado aqui solo al caso sin catalogar).
 * `unitValue`/`totalValue` no se validan aqui: los calcularia el servicio
 * a partir de `Product.cost`, nunca se reciben del cliente.
 */
export const CreateInventoryWasteSchema = z
  .object({
    sucursalId: z
      .string({ required_error: 'La sucursal es obligatoria.' })
      .uuid('La sucursal debe ser un identificador válido.'),
    productId: z
      .string({ required_error: 'El producto es obligatorio.' })
      .uuid('El producto debe ser un identificador válido.'),
    reason: WasteReasonSchema,
    notes: z.string().trim().min(1, 'La nota no puede estar vacía.').nullish(),
    quantity: z
      .number({ required_error: 'La cantidad es obligatoria.' })
      .positive('La cantidad debe ser un número positivo.'),
    sourceReturnItemId: z
      .string()
      .uuid('La línea de devolución debe ser un identificador válido.')
      .nullish(),
    batchId: z.string().uuid('El lote debe ser un identificador válido.').nullish(),
  })
  .refine(
    (data) => data.reason !== 'OTHER' || Boolean(data.notes && data.notes.trim().length > 0),
    {
      message: 'Debe indicar una nota cuando el origen es "Otro".',
      path: ['notes'],
    },
  );

export type CreateInventoryWasteBodyDto = z.infer<typeof CreateInventoryWasteSchema>;

/** Validacion de los query params para un futuro listado de mermas (ver
 * `ListInventoryWastesQuery` en `types.ts`, todavia sin implementar). */
export const ListInventoryWastesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador válido.').optional(),
  productId: z.string().uuid('El producto debe ser un identificador válido.').optional(),
  userId: z.string().uuid('El usuario debe ser un identificador válido.').optional(),
  reason: WasteReasonSchema.optional(),
});

export type ListInventoryWastesQueryDto = z.infer<typeof ListInventoryWastesQuerySchema>;
