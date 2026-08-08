/**
 * modules/processing/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) del modulo de Despiece (Bloque 2 del plan v3).
 * Define la forma y las reglas de los datos de entrada; NO contiene logica
 * de negocio (validar stock disponible, balance de peso, o la regla "lote
 * obligatorio cuando `Product.requiresBatch`" requiere leer la base de
 * datos -- eso vive en `service.ts`).
 *
 * Sin controller.ts/routes.ts en este bloque (Bloque 3 los agrega) -- estos
 * esquemas quedan preparados para cuando existan esos endpoints, mismo
 * criterio que `batches/validation.ts` (`UpdateBatchSchema` sin
 * `CreateBatchSchema` hasta que existiera `POST /batches`) e
 * `inventoryWaste/validation.ts` (`CreateInventoryWasteSchema` ya completo
 * antes de tener su propio endpoint).
 *
 * `performedByUserId` no se valida aca -- viajaria por `req.user`, nunca por
 * el body (mismo criterio que `CreateInventoryWasteSchema`).
 */
import { z } from 'zod';

/** Estados soportados (enum `ProcessingStatus` de `schema.prisma`). */
const ProcessingStatusSchema = z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']);

/** Motivos soportados para una linea de merma (enum `WasteReason` de
 * `schema.prisma`). Misma lista que `inventoryWaste/validation.ts`. */
const ProcessingWasteReasonSchema = z.enum([
  'RETURNED_NOT_RESTOCKED',
  'EXPIRED',
  'DAMAGED',
  'PRODUCTION_ERROR',
  'CUTTING_ERROR',
  'PACKAGING_ERROR',
  'COLD_CHAIN_FAILURE',
  'PROCESSING_LOSS',
  'OTHER',
]);

/** Validacion del cuerpo de la peticion de creacion de una operacion de
 * despiece (`DRAFT`). */
export const CreateProcessingOperationSchema = z.object({
  sucursalId: z
    .string({ required_error: 'La sucursal es obligatoria.' })
    .uuid('La sucursal debe ser un identificador válido.'),
  inputProductId: z
    .string({ required_error: 'El producto de entrada es obligatorio.' })
    .uuid('El producto de entrada debe ser un identificador válido.'),
  inputBatchId: z.string().uuid('El lote debe ser un identificador válido.').nullish(),
  inputQuantity: z
    .number({ required_error: 'La cantidad de entrada es obligatoria.' })
    .positive('La cantidad de entrada debe ser un número positivo.'),
  notes: z.string().trim().min(1, 'La nota no puede estar vacía.').nullish(),
});

export type CreateProcessingOperationBodyDto = z.infer<typeof CreateProcessingOperationSchema>;

/** Validacion del cuerpo de la peticion de edicion de una operacion
 * (`PATCH`, solo mientras sigue `DRAFT` -- validado en `service.ts`). */
export const UpdateProcessingOperationSchema = z.object({
  notes: z.string().trim().min(1, 'La nota no puede estar vacía.').nullish(),
});

export type UpdateProcessingOperationBodyDto = z.infer<typeof UpdateProcessingOperationSchema>;

/** Validacion del cuerpo de la peticion de alta de una linea de salida
 * (corte/subproducto). */
export const AddProcessingOutputItemSchema = z.object({
  outputProductId: z
    .string({ required_error: 'El producto de salida es obligatorio.' })
    .uuid('El producto de salida debe ser un identificador válido.'),
  quantity: z
    .number({ required_error: 'La cantidad es obligatoria.' })
    .positive('La cantidad debe ser un número positivo.'),
});

export type AddProcessingOutputItemBodyDto = z.infer<typeof AddProcessingOutputItemSchema>;

/** Validacion del cuerpo de la peticion de edicion de una linea de salida
 * (solo la cantidad -- ver nota de `types.ts`). */
export const UpdateProcessingOutputItemSchema = z.object({
  quantity: z
    .number({ required_error: 'La cantidad es obligatoria.' })
    .positive('La cantidad debe ser un número positivo.'),
});

export type UpdateProcessingOutputItemBodyDto = z.infer<typeof UpdateProcessingOutputItemSchema>;

/** Validacion del cuerpo de la peticion de alta de una linea de merma. */
export const AddProcessingWasteItemSchema = z.object({
  reason: ProcessingWasteReasonSchema,
  quantity: z
    .number({ required_error: 'La cantidad es obligatoria.' })
    .positive('La cantidad debe ser un número positivo.'),
  notes: z.string().trim().min(1, 'La nota no puede estar vacía.').nullish(),
});

export type AddProcessingWasteItemBodyDto = z.infer<typeof AddProcessingWasteItemSchema>;

/** Validacion del cuerpo de la peticion de edicion de una linea de merma
 * (cantidad, motivo y notas son editables, a diferencia de una linea de
 * salida). */
export const UpdateProcessingWasteItemSchema = z.object({
  reason: ProcessingWasteReasonSchema.optional(),
  quantity: z.number().positive('La cantidad debe ser un número positivo.').optional(),
  notes: z.string().trim().min(1, 'La nota no puede estar vacía.').nullish(),
});

export type UpdateProcessingWasteItemBodyDto = z.infer<typeof UpdateProcessingWasteItemSchema>;

/** Validacion de los query params para el listado de operaciones de
 * despiece. */
export const ListProcessingOperationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador válido.').optional(),
  inputProductId: z
    .string()
    .uuid('El producto de entrada debe ser un identificador válido.')
    .optional(),
  status: ProcessingStatusSchema.optional(),
});

export type ListProcessingOperationsQueryDto = z.infer<typeof ListProcessingOperationsQuerySchema>;
