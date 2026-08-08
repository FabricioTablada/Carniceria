/**
 * modules/sales/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de ventas.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `sales.service.ts`).
 *
 * NOTA: el modelo `Sale` no tiene campo `active`, por lo que no existe un
 * esquema de cambio de estado en este modulo.
 *
 * REGLA CRITICA: `lineSubtotal`, `lineTax`, `lineTotal`, `subtotal`,
 * `taxTotal`, `discountTotal`, `total` y `changeGiven` no forman parte de
 * estos esquemas. Siguiendo el mismo patron aprobado en Purchases, un
 * backend de POS no debe aceptar totales calculados por el cliente;
 * `sales.service.ts` los calcula siempre a partir de `quantity`,
 * `unitPrice`, `discount` y `amountPaid`, junto con la tasa del impuesto
 * almacenada en la base de datos.
 */
import { z } from 'zod';

/** Estados soportados (enum `SaleStatus` de `schema.prisma`). */
const SaleStatusSchema = z.enum(['COMPLETED', 'CANCELLED', 'REFUNDED']);

/** Metodos de pago soportados (enum `PaymentMethod` de `schema.prisma`). */
const PaymentMethodSchema = z.enum(['CASH', 'CARD', 'SINPE_MOVIL', 'TRANSFER', 'MIXED']);

/** Metodos de pago electronicos que exigen una referencia (QA-007): numero
 * de autorizacion/voucher de tarjeta, comprobante SINPE, o numero de
 * transferencia. Deliberadamente NO incluye `MIXED` — el pedido original
 * solo cubre tarjeta/SINPE/transferencia como metodos unicos; un pago
 * mixto no tiene una unica referencia bien definida y queda fuera de este
 * alcance. */
const ELECTRONIC_PAYMENT_METHODS = ['CARD', 'SINPE_MOVIL', 'TRANSFER'] as const;

/** Tipo de descuento de carrito soportado (enum `SaleDiscountType` de
 * `schema.prisma`). */
const SaleDiscountTypeSchema = z.enum(['NONE', 'PERCENTAGE', 'FIXED']);

/** Validacion de un detalle de venta dentro del cuerpo de creacion. Solo se
 * aceptan los datos que el cliente puede conocer de antemano; los importes
 * de linea los calcula el servicio. Exportado (Bloque P.7): `SaleQuoteSchema`
 * reutiliza este mismo schema para los detalles de una cotizacion — la
 * forma de un detalle de venta y la de un detalle de cotizacion son, a
 * proposito, identicas. */
export const CreateSaleItemSchema = z.object({
  productId: z
    .string({ required_error: 'El producto es obligatorio.' })
    .uuid('El producto debe ser un identificador valido.'),
  taxId: z.string().uuid('El impuesto debe ser un identificador valido.').nullish(),
  quantity: z
    .number({ required_error: 'La cantidad es obligatoria.' })
    .positive('La cantidad debe ser un numero positivo.'),
  unitPrice: z
    .number({ required_error: 'El precio unitario es obligatorio.' })
    .min(0, 'El precio unitario debe ser mayor o igual a 0.'),
  discount: z.number().min(0, 'El descuento debe ser mayor o igual a 0.').optional(),
});

/** Validacion del cuerpo de la peticion de creacion de venta. Los totales
 * (`subtotal`, `taxTotal`, `discountTotal`, `total`, `changeGiven`) no se
 * validan aqui porque no se reciben del cliente: los calcula
 * `sales.service.ts`. `sucursalId` y `userId` tampoco se validan aqui:
 * los resuelve `sales.controller.ts` desde `req.user` (adjuntado por
 * `authenticate.middleware.ts`), no desde el body — ver CreateSaleDto en
 * `types.ts` para la forma completa que efectivamente recibe el servicio. */
export const CreateSaleSchema = z
  .object({
    cashSessionId: z
      .string({ required_error: 'La sesion de caja es obligatoria.' })
      .uuid('La sesion de caja debe ser un identificador valido.'),
    documentNumber: z.string().nullish(),
    status: SaleStatusSchema.optional(),
    paymentMethod: PaymentMethodSchema.optional(),
    // Bloque 8.3: cliente seleccionado en el POS — `null`/ausente = "Publico
    // General" (comportamiento por defecto, sin cambios de flujo).
    customerId: z.string().uuid('El cliente debe ser un identificador valido.').nullish(),
    // QA-007: numero de autorizacion/voucher, comprobante SINPE o numero
    // de transferencia. Nullish porque CASH nunca lo requiere (ver el
    // `.refine()` de abajo, que es quien exige presencia segun
    // `paymentMethod`, no este campo por si solo).
    paymentReference: z.string().trim().min(1, 'La referencia de pago no puede estar vacía.').nullish(),
    saleDate: z.coerce.date().optional(),
    amountPaid: z.number().min(0, 'El monto pagado debe ser mayor o igual a 0.').optional(),
    notes: z.string().nullish(),
    // Descuento de carrito (no de linea): `discountValue` es el numero tal
    // como lo ingreso el cajero (10 = 10% si `discountType` es PERCENTAGE,
    // 500 = ₡500 si es FIXED). El monto real descontado y su tope contra
    // el subtotal se calculan en `sales.service.ts`, que es quien conoce
    // el subtotal real (no se puede validar aqui, antes de calcular
    // `items`). El rango 0-100 de PERCENTAGE si se valida aqui porque no
    // depende de ningun dato calculado.
    discountType: SaleDiscountTypeSchema.optional(),
    discountValue: z.number().min(0, 'El descuento no puede ser negativo.').optional(),
    items: z.array(CreateSaleItemSchema).min(1, 'La venta debe incluir al menos un detalle.'),
  })
  .refine(
    (data) =>
      data.discountType !== 'PERCENTAGE' ||
      data.discountValue === undefined ||
      data.discountValue <= 100,
    {
      message: 'El porcentaje de descuento no puede ser mayor a 100.',
      path: ['discountValue'],
    },
  )
  .refine(
    (data) => {
      const method = data.paymentMethod ?? 'CASH';
      const requiresReference = (ELECTRONIC_PAYMENT_METHODS as readonly string[]).includes(method);
      return !requiresReference || Boolean(data.paymentReference && data.paymentReference.trim().length > 0);
    },
    {
      message: 'La referencia de pago es obligatoria para tarjeta, SINPE o transferencia.',
      path: ['paymentReference'],
    },
  );

export type CreateSaleDto = z.infer<typeof CreateSaleSchema>;

/**
 * Validacion del cuerpo de la peticion de cotizacion (Bloque P.7,
 * `POST /sales/quote`). Deliberadamente MAS CHICO que `CreateSaleSchema`:
 * una cotizacion no crea nada, asi que no acepta `cashSessionId`,
 * `paymentMethod`/`paymentReference`, `amountPaid`, `status`,
 * `documentNumber` ni `notes` — ninguno de esos campos participa del
 * calculo de subtotal/impuesto/descuento/total. `items`/`discountType`/
 * `discountValue` son EXACTAMENTE los mismos campos y las mismas reglas
 * que ya usa `CreateSaleSchema` (mismo `CreateSaleItemSchema`, mismo tope
 * de 100% para descuento porcentual) — el objetivo explicito del Bloque
 * P.7 es que la cotizacion y la venta confirmada, con el mismo carrito,
 * produzcan el mismo resultado; empezar por validar el mismo carrito con
 * las mismas reglas es parte de esa garantia. */
export const SaleQuoteSchema = z
  .object({
    discountType: SaleDiscountTypeSchema.optional(),
    discountValue: z.number().min(0, 'El descuento no puede ser negativo.').optional(),
    items: z.array(CreateSaleItemSchema).min(1, 'La cotización debe incluir al menos un detalle.'),
  })
  .refine(
    (data) =>
      data.discountType !== 'PERCENTAGE' ||
      data.discountValue === undefined ||
      data.discountValue <= 100,
    {
      message: 'El porcentaje de descuento no puede ser mayor a 100.',
      path: ['discountValue'],
    },
  );

export type CreateSaleQuoteDto = z.infer<typeof SaleQuoteSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de venta.
 * Los detalles (`items`) no se editan a traves de esta operacion, y por lo
 * tanto tampoco los totales derivados de ellos. */
export const UpdateSaleSchema = z.object({
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  userId: z.string().uuid('El usuario debe ser un identificador valido.').optional(),
  cashSessionId: z.string().uuid('La sesion de caja debe ser un identificador valido.').optional(),
  documentNumber: z.string().nullish(),
  status: SaleStatusSchema.optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  // QA-007: sin el `.refine()` de `CreateSaleSchema` — esta operacion no
  // edita `items` ni recalcula nada, y la UI actual no permite cambiar el
  // metodo de pago de una venta ya registrada; se deja disponible para
  // poder corregir/completar una referencia ya cargada, sin forzar la
  // regla de obligatoriedad fuera del flujo de creacion.
  paymentReference: z.string().trim().min(1, 'La referencia de pago no puede estar vacía.').nullish(),
  saleDate: z.coerce.date().optional(),
  amountPaid: z.number().min(0, 'El monto pagado debe ser mayor o igual a 0.').optional(),
  notes: z.string().nullish(),
  // Version 1.0.5, Bloque 1: permite asignar un cliente real a una venta
  // creada como "Publico General" (`customerId: null` al crear) — SOLO
  // antes de emitir su Factura Electronica. La validacion fiscal real
  // (sin factura emitida, sin emision incierta, no anulada) vive en
  // `sales.service.ts::update()`, no aca (este schema solo valida la
  // FORMA del dato, igual que `CreateSaleSchema`).
  customerId: z.string().uuid('El cliente debe ser un identificador valido.').nullish(),
});

export type UpdateSaleDto = z.infer<typeof UpdateSaleSchema>;

/** Validacion del cuerpo de la peticion de anulacion de venta (Bloque 3,
 * "Anulacion/Correccion de Venta"). `reason` es obligatorio: a diferencia
 * de `notes` (siempre opcional en el resto del modulo), anular exige
 * justificacion. */
export const VoidSaleSchema = z.object({
  reason: z
    .string({ required_error: 'El motivo de la anulación es obligatorio.' })
    .trim()
    .min(1, 'El motivo de la anulación es obligatorio.'),
});

export type VoidSaleDto = z.infer<typeof VoidSaleSchema>;

/** Validacion del cuerpo de la peticion de correccion de venta (Bloque 3).
 * Mismas reglas de `items`/`paymentMethod`/`paymentReference`/`discountType`
 * que `CreateSaleSchema` (una correccion sigue siendo, en esencia, una
 * venta nueva) mas `reason` obligatorio, igual que `VoidSaleSchema` — la
 * correccion tambien anula la venta original y esa anulacion necesita su
 * propio motivo. Sin `cashSessionId`/`sucursalId`/`documentNumber`: la
 * venta correctiva siempre hereda sucursal y sesion de caja de la venta
 * original (ver `CorrectSaleDto` en `types.ts`). */
export const CorrectSaleSchema = z
  .object({
    reason: z
      .string({ required_error: 'El motivo de la corrección es obligatorio.' })
      .trim()
      .min(1, 'El motivo de la corrección es obligatorio.'),
    paymentMethod: PaymentMethodSchema.optional(),
    paymentReference: z.string().trim().min(1, 'La referencia de pago no puede estar vacía.').nullish(),
    amountPaid: z.number().min(0, 'El monto pagado debe ser mayor o igual a 0.').optional(),
    notes: z.string().nullish(),
    discountType: SaleDiscountTypeSchema.optional(),
    discountValue: z.number().min(0, 'El descuento no puede ser negativo.').optional(),
    items: z.array(CreateSaleItemSchema).min(1, 'La venta debe incluir al menos un detalle.'),
  })
  .refine(
    (data) =>
      data.discountType !== 'PERCENTAGE' ||
      data.discountValue === undefined ||
      data.discountValue <= 100,
    {
      message: 'El porcentaje de descuento no puede ser mayor a 100.',
      path: ['discountValue'],
    },
  )
  .refine(
    (data) => {
      const method = data.paymentMethod ?? 'CASH';
      const requiresReference = (ELECTRONIC_PAYMENT_METHODS as readonly string[]).includes(method);
      return !requiresReference || Boolean(data.paymentReference && data.paymentReference.trim().length > 0);
    },
    {
      message: 'La referencia de pago es obligatoria para tarjeta, SINPE o transferencia.',
      path: ['paymentReference'],
    },
  );

export type CorrectSaleBodyDto = z.infer<typeof CorrectSaleSchema>;

/** Validacion de los query params para el listado de ventas. */
export const ListSalesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  userId: z.string().uuid('El usuario debe ser un identificador valido.').optional(),
  cashSessionId: z.string().uuid('La sesion de caja debe ser un identificador valido.').optional(),
  status: SaleStatusSchema.optional(),
});

export type ListSalesQueryDto = z.infer<typeof ListSalesQuerySchema>;
