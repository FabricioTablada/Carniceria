/**
 * modules/purchases/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de compras.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `purchases.service.ts`).
 *
 * NOTA: el modelo `Purchase` no tiene campo `active`, por lo que no existe
 * un esquema de cambio de estado en este modulo.
 *
 * REGLA CRITICA: `lineSubtotal`, `lineTax`, `lineTotal`, `subtotal`,
 * `taxTotal` y `total` no forman parte de estos esquemas. Un backend de POS
 * no debe aceptar totales calculados por el cliente; `purchases.service.ts`
 * los calcula siempre a partir de `quantity`, `unitCost` y la tasa del
 * impuesto almacenada en la base de datos.
 */
import { z } from 'zod';

/** Estados soportados (enum `PurchaseStatus` de `schema.prisma`). */
const PurchaseStatusSchema = z.enum(['DRAFT', 'RECEIVED', 'CANCELLED']);

/** Validacion de un detalle de compra dentro del cuerpo de creacion. Solo se
 * aceptan los datos que el cliente puede conocer de antemano; los importes
 * de linea los calcula el servicio. */
const CreatePurchaseItemSchema = z.object({
  productId: z
    .string({ required_error: 'El producto es obligatorio.' })
    .uuid('El producto debe ser un identificador valido.'),
  taxId: z.string().uuid('El impuesto debe ser un identificador valido.').nullish(),
  quantity: z
    .number({ required_error: 'La cantidad es obligatoria.' })
    .positive('La cantidad debe ser un numero positivo.'),
  unitCost: z
    .number({ required_error: 'El costo unitario es obligatorio.' })
    .min(0, 'El costo unitario debe ser mayor o igual a 0.'),
  // Bloque COST-06.1 (merma por linea de compra): opcional — mismo rango
  // que `Product.expectedWastePercent` (Bloque 14.4). `null`/ausente =
  // esta linea no especifica una merma de lote, nunca se infiere 0.
  expectedWastePercent: z
    .number()
    .min(0, 'El porcentaje de merma esperada debe ser mayor o igual a 0.')
    .max(100, 'El porcentaje de merma esperada debe ser menor o igual a 100.')
    .nullish(),
  // Bloque LOTES-09 (integracion completa con Compras): trazabilidad del
  // lote de esta recepcion, propagada tal cual a `Batch` cuando el
  // producto tiene `Product.requiresBatch` (ver
  // `createBatchesForReceivedPurchase`). Solo se valida FORMATO/tipo aqui
  // (y el orden relativo `expiryDate >= productionDate` mas abajo, un
  // chequeo temprano de UX) -- la regla de negocio AUTORITATIVA (fecha de
  // vencimiento/produccion contra la fecha de recepcion real de la compra)
  // ya vive en `batches/service.ts::create()` y no se duplica aca: esa
  // funcion la vuelve a aplicar de todas formas al crear el lote.
  supplierLotCode: z.string().nullish(),
  productionDate: z.coerce.date().nullish(),
  expiryDate: z.coerce.date().nullish(),
}).refine(
  (item) => !item.productionDate || !item.expiryDate || item.expiryDate >= item.productionDate,
  {
    message: 'La fecha de vencimiento no puede ser anterior a la fecha de producción.',
    path: ['expiryDate'],
  },
);

/** Validacion del cuerpo de la peticion de creacion de compra. Los totales
 * (`subtotal`, `taxTotal`, `total`) no se validan aqui porque no se reciben
 * del cliente: los calcula `purchases.service.ts`. `sucursalId`/`userId`
 * tampoco se validan aqui: los resuelve `purchases.controller.ts` desde
 * `req.user` (JWT, via `authenticate.middleware.ts`), mismo criterio ya
 * aplicado en `sales.validation.ts` y en `openSession`/`closeSession` de
 * `cash.validation.ts`. */
export const CreatePurchaseSchema = z.object({
  supplierId: z
    .string({ required_error: 'El proveedor es obligatorio.' })
    .uuid('El proveedor debe ser un identificador valido.'),
  documentNumber: z.string().nullish(),
  status: PurchaseStatusSchema.optional(),
  purchaseDate: z.coerce.date().optional(),
  notes: z.string().nullish(),
  items: z.array(CreatePurchaseItemSchema).min(1, 'La compra debe incluir al menos un detalle.'),
});

export type CreatePurchaseDto = z.infer<typeof CreatePurchaseSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de compra.
 * Los detalles (`items`) no se editan a traves de esta operacion, y por lo
 * tanto tampoco los totales derivados de ellos. `sucursalId` y `userId`
 * TAMPOCO se aceptan del cliente aqui: a diferencia de `create` (donde se
 * resuelven desde `req.user`), en `update` ninguno de los dos campos
 * tiene sentido de negocio para ser editable despues de creada la
 * compra — reasignar a que sucursal/usuario pertenece una compra ya
 * existente corrompe el rastro de auditoria sin dejar ningun indicio. */
export const UpdatePurchaseSchema = z.object({
  supplierId: z.string().uuid('El proveedor debe ser un identificador valido.').optional(),
  documentNumber: z.string().nullish(),
  status: PurchaseStatusSchema.optional(),
  purchaseDate: z.coerce.date().optional(),
  notes: z.string().nullish(),
});

export type UpdatePurchaseDto = z.infer<typeof UpdatePurchaseSchema>;

/** Validacion de los query params para el listado de compras. */
export const ListPurchasesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  supplierId: z.string().uuid('El proveedor debe ser un identificador valido.').optional(),
  status: PurchaseStatusSchema.optional(),
});

export type ListPurchasesQueryDto = z.infer<typeof ListPurchasesQuerySchema>;