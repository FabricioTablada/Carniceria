/**
 * modules/sales/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de ventas.
 * Define unicamente las formas de datos que consumen `sales.service.ts`,
 * `sales.repository.ts` y `sales.controller.ts`; no contiene logica de
 * negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `sales.service.ts`, `sales.repository.ts` y
 * `sales.validation.ts`).
 *
 * NOTA: no existe modelo `Customer` en `schema.prisma`; la venta se asocia
 * unicamente a sucursal, usuario (cajero) y sesion de caja.
 *
 * NOTA: el modelo `Sale` de `schema.prisma` no tiene campo `active`, por lo
 * que este modulo no expone cambio de estado (a diferencia de Categories,
 * Products, Taxes y Suppliers). Si tiene la restriccion
 * `@@unique([sucursalId, documentNumber])`, por lo que si valida duplicados
 * (a diferencia de Purchases).
 *
 * REGLA CRITICA: `lineSubtotal`, `lineTax`, `lineTotal`, `subtotal`,
 * `taxTotal`, `discountTotal`, `total` y `changeGiven` NUNCA se reciben del
 * cliente. Siguiendo el mismo patron aprobado en Purchases, estos valores
 * los calcula siempre `sales.service.ts` a partir de `quantity`,
 * `unitPrice`, `discount` y `amountPaid`, junto con la tasa del impuesto
 * almacenada en la base de datos. Por eso no existen en
 * `CreateSaleItemDto`, `CreateSaleDto` ni `UpdateSaleDto`: solo aparecen en
 * las formas de respuesta (`SaleItemResponse`, `SaleResponse`).
 *
 * `discountType`/`discountValue` (descuento de CARRITO, no de linea) son la
 * unica excepcion parcial a esa regla: el cliente SI los envia (la
 * seleccion %/₡ y el valor que ingreso el cajero), pero el monto resultante
 * (`discountTotal`) y el `total` final siguen calculandose siempre en
 * `sales.service.ts` — el cliente nunca envia el monto ya calculado, solo
 * la intencion (tipo + valor).
 */
import type { PaginationParams } from '@/shared/utils/pagination';
import type { PromotionEffectType } from '@/modules/promotions';

/** Estado de la venta (enum `SaleStatus` de `schema.prisma`). */
export type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

/** Metodo de pago (enum `PaymentMethod` de `schema.prisma`). */
export type PaymentMethod = 'CASH' | 'CARD' | 'SINPE_MOVIL' | 'TRANSFER' | 'MIXED';

/** Tipo de descuento de carrito (enum `SaleDiscountType` de `schema.prisma`).
 * Distinto de `SaleItem.discount` (descuento por linea, ya existente). */
export type SaleDiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';

/** Estado de la sesion de caja (enum `CashSessionStatus` de `schema.prisma`). */
export type CashSessionStatus = 'OPEN' | 'CLOSED';

/** Resumen de la sucursal asociada a una venta. */
export interface SaleSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Resumen del usuario (cajero) que registro la venta. */
export interface SaleUserSummary {
  id: string;
  fullName: string;
}

/** Resumen del cliente asociado a una venta (Bloque 8.3, modulo de
 * Clientes) — `null` = "Publico General". */
export interface SaleCustomerSummary {
  id: string;
  name: string;
  identificationType: string;
  identificationNumber: string;
  // Bloque 8.4: el frontend lo usa para precargar/usar automaticamente el
  // correo del cliente al reenviar el comprobante ("Reenviar" ya no pide
  // el correo a mano cuando la venta tiene un cliente asociado con correo
  // guardado) — `null` si el cliente no tiene correo cargado.
  email: string | null;
}

/** Resumen de la sesion de caja asociada a una venta. */
export interface SaleCashSessionSummary {
  id: string;
  status: CashSessionStatus;
}

/** Unidad de medida del producto (enum `UnitOfMeasure` de `schema.prisma`).
 * Declarada localmente, mismo criterio ya usado en `reports.types.ts`. */
export type SaleItemProductUnitOfMeasure = 'KILOGRAM' | 'UNIT';

/** Resumen del producto de un detalle de venta (Bloque 3, "Detalle de
 * Venta"): nombre/SKU/unidad para mostrar la linea sin un lookup aparte. */
export interface SaleItemProductSummary {
  id: string;
  name: string;
  sku: string | null;
  unitOfMeasure: SaleItemProductUnitOfMeasure;
}

/** Resumen del impuesto de un detalle de venta (Bloque 3). */
export interface SaleItemTaxSummary {
  id: string;
  name: string;
}

/** Forma de un detalle de venta tal como lo expone el modulo. `unitPrice` y
 * `discount` son los valores recibidos del cliente; `taxRate`,
 * `lineSubtotal`, `lineTax` y `lineTotal` son SNAPSHOT calculados por el
 * servicio al momento de la venta. `product`/`tax` (Bloque 3): resumen
 * resuelto por el repositorio (`saleWithRelationsInclude`), no solo el id. */
export interface SaleItemResponse {
  id: string;
  productId: string;
  taxId: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  /** Bloque 14.2 (Costos Base): snapshot de `Product.cost` al momento de la
   * venta. `null` unicamente en ventas creadas antes de este bloque (costo
   * historico desconocido, nunca inferido del costo actual del producto). */
  unitCost: number | null;
  product: SaleItemProductSummary;
  tax: SaleItemTaxSummary | null;
}

/** Resumen minimo de una venta relacionada (original o correctiva),
 * Bloque 3 ("Anulacion/Correccion de Venta"). */
export interface RelatedSaleSummary {
  id: string;
  documentNumber: string | null;
  status: SaleStatus;
}

/** Origen de un descuento aplicado (enum `PromotionSource` de
 * `schema.prisma`, Bloque P.1). Hoy solo se genera `MANUAL`; `AUTOMATIC`
 * queda preparado para cuando exista un motor de reglas de promociones. */
export type PromotionSource = 'MANUAL' | 'AUTOMATIC';

/** Resumen del usuario que aplico un descuento manual (Bloque P.1/P.2).
 * `null` cuando el descuento fue automatico (todavia sin implementar). */
export interface SaleAppliedPromotionUserSummary {
  id: string;
  fullName: string;
}

/**
 * Un descuento REALMENTE aplicado a la venta, tal como lo expone el
 * modulo (Bloque P.2, exposicion de `SaleAppliedPromotion`). Es un
 * registro de AUDITORIA — que ocurrio, cuanto impacto, quien o que lo
 * origino, cuando — nunca una regla de negocio configurable (eso vive,
 * hoy sin implementar, en un futuro catalogo `Promotion`). Por eso no
 * tiene campos de "vigencia"/"condicion"/"prioridad": esos conceptos no
 * le pertenecen a esta entidad.
 *
 * `saleItemId` (Bloque P.1): `null` = descuento de carrito completo (el
 * unico caso real hoy); en el futuro, un id real ligaria el descuento a
 * la linea especifica que beneficio (promociones automaticas por
 * producto/combo).
 */
export interface SaleAppliedPromotionResponse {
  id: string;
  saleItemId: string | null;
  source: PromotionSource;
  promotionNameSnapshot: string;
  discountType: SaleDiscountType;
  discountValue: number;
  amountApplied: number;
  appliedByUser: SaleAppliedPromotionUserSummary | null;
  createdAt: Date;
  /** Deuda tecnica del motor de promociones, Bloque 4 (exposicion via
   * API): complementan, sin reemplazar, `discountType`/
   * `promotionNameSnapshot` de arriba — preservan el tipo real de la
   * regla (`PromotionEffectType` completo, no el vocabulario mas angosto
   * de `discountType`) y el id de la promocion de catalogo que la
   * origino. `null` para descuentos MANUALES (no son una regla de
   * catalogo) y para filas creadas antes de este bloque. */
  effectType: PromotionEffectType | null;
  promotionId: string | null;
  /** PROMO-10 (snapshot historico de rentabilidad comercial): copia de
   * `commercialOrigin`/`fundingType`/`supplierId`/`supplierSubsidyValue`
   * (PROMO-03, `Promotion`) vigentes en el momento EXACTO de esta venta —
   * nunca se releen desde `Promotion` despues, mismo criterio que
   * `SaleItem.expectedWastePercentAtSale`. Si la promocion se edita mas
   * adelante, estos valores no cambian. Default (`INTERNAL`/`NONE`/
   * `null`/`null`) para descuentos MANUALES y para filas creadas antes de
   * este bloque. */
  commercialOrigin: 'INTERNAL' | 'SUPPLIER_MANDATED';
  fundingType: 'NONE' | 'SUPPLIER_SUBSIDY_PER_UNIT' | 'SUPPLIER_SUBSIDY_PERCENTAGE';
  supplierId: string | null;
  supplierSubsidyValue: number | null;
  /** Monto REALMENTE aplicado por el proveedor en esta fila (distinto de
   * `supplierSubsidyValue`, el parametro CRUDO de la regla) — `null`
   * cuando `fundingType: 'NONE'`. */
  supplierContributionAmount: number | null;
}

/** Forma de una venta tal como la expone el modulo hacia el resto de la app.
 * `subtotal`, `taxTotal`, `discountTotal`, `total` y `changeGiven` son
 * calculados por el servicio; nunca se reciben del cliente. */
export interface SaleResponse {
  id: string;
  sucursalId: string;
  userId: string;
  cashSessionId: string;
  documentNumber: string | null;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  /** Referencia del pago electronico (QA-007): numero de autorizacion/
   * voucher de tarjeta, comprobante SINPE o numero de transferencia. Nula
   * para CASH (y para MIXED, fuera del alcance de esta regla). */
  paymentReference: string | null;
  saleDate: Date;
  subtotal: number;
  taxTotal: number;
  discountType: SaleDiscountType;
  discountValue: number;
  discountTotal: number;
  total: number;
  amountPaid: number;
  changeGiven: number;
  notes: string | null;
  sucursal: SaleSucursalSummary;
  user: SaleUserSummary;
  cashSession: SaleCashSessionSummary;
  /** Bloque 8.3: cliente asociado a esta venta — `null` = "Publico
   * General" (comportamiento por defecto). Puramente informativo: NO
   * participa todavia de la emision electronica en Alegra (Bloque 8.4,
   * fuera de alcance aca). */
  customerId: string | null;
  customer: SaleCustomerSummary | null;
  items: SaleItemResponse[];
  /** Bloque P.2 (Motor de Promociones, exposicion de la auditoria): cada
   * descuento realmente aplicado a esta venta — hoy, a lo sumo uno (el
   * descuento manual de carrito, Bloque P.1). Complementa, no reemplaza,
   * a `discountType`/`discountValue`/`discountTotal` (que siguen siendo
   * el agregado ya calculado). */
  appliedPromotions: SaleAppliedPromotionResponse[];
  /** Trazabilidad de correccion (Bloque 3): si esta venta es una venta
   * CORRECTIVA (reemplaza a otra ya anulada), `originalSale` referencia la
   * venta que reemplaza. Si esta venta YA FUE corregida, `correctedBySale`
   * referencia la venta correctiva que la reemplaza. Una venta nunca tiene
   * ambas a la vez en la practica (una correctiva no se corrige a si misma
   * encadenandose sobre la misma venta), pero el modelo no lo impide
   * estructuralmente — ver comentario en `schema.prisma`. */
  originalSaleId: string | null;
  originalSale: RelatedSaleSummary | null;
  correctedBySaleId: string | null;
  correctedBySale: RelatedSaleSummary | null;
  /** Bloque 7.16: lectura del resultado de la emision electronica en
   * Alegra (`modules/integrations/alegra`, Bloque 7.7/7.15) — `null`
   * mientras no se emitio (o si Alegra no esta configurado). El frontend
   * los usa unicamente para saber si ya existe un documento electronico
   * descargable (`GET /integrations/alegra/sales/:saleId/invoice-pdf`/
   * `-xml`, que siguen siendo las unicas rutas que tocan Alegra) — este
   * modulo no gana logica nueva, solo deja de ocultar datos que `Sale` ya
   * tenia. */
  alegraInvoiceId: string | null;
  alegraInvoiceStatus: string | null;
  alegraElectronicKey: string | null;
  /** Version 1.0.5, Bloque 1: mismo criterio que los 3 campos de arriba —
   * de solo lectura, el frontend lo usa para ocultar el botón "Asignar
   * cliente" mientras una emisión quede en estado incierto. */
  alegraEmissionUncertainAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un detalle de venta dentro de
 * `CreateSaleDto`. El cliente solo declara el producto, el impuesto (si
 * aplica), la cantidad, el precio unitario y el descuento de linea (si
 * aplica); `lineSubtotal`, `lineTax` y `lineTotal` los calcula el
 * servicio. */
export interface CreateSaleItemDto {
  productId: string;
  taxId?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

/** Datos requeridos para crear una venta junto con sus detalles.
 * `subtotal`, `taxTotal`, `discountTotal`, `total` y `changeGiven` los
 * calcula el servicio a partir de `items` y `amountPaid`; el cliente no los
 * envia. `sucursalId` y `userId` tampoco los envia el cliente: los resuelve
 * `sales.controller.ts` desde `req.user` (JWT, via `authenticate.middleware.ts`)
 * antes de llamar a `sales.service.create()`. La forma completa se
 * mantiene aqui sin cambios porque el servicio y el repositorio siguen
 * necesitando ambos campos para crear la venta; lo que cambio es de donde
 * los obtiene el controller, no que datos requiere el servicio. */
export interface CreateSaleDto {
  sucursalId: string;
  userId: string;
  cashSessionId: string;
  documentNumber?: string | null;
  status?: SaleStatus;
  paymentMethod?: PaymentMethod;
  /** Bloque 8.3: cliente seleccionado en el POS — `null`/`undefined` =
   * "Publico General" (comportamiento por defecto). */
  customerId?: string | null;
  /** Requerida por `CreateSaleSchema` cuando `paymentMethod` es
   * CARD/SINPE_MOVIL/TRANSFER (QA-007); no se envia para CASH. */
  paymentReference?: string | null;
  saleDate?: Date;
  amountPaid?: number;
  notes?: string | null;
  /** Descuento de carrito (no de linea). `discountValue` es el numero tal
   * como lo ingreso el cajero; `discountTotal` (monto ya calculado) y
   * `total` los deriva `sales.service.ts` — no se reciben del cliente. */
  discountType?: SaleDiscountType;
  discountValue?: number;
  items: CreateSaleItemDto[];
}

/**
 * Datos requeridos para cotizar una venta (Bloque P.7,
 * `POST /sales/quote`). Mismos `items`/`discountType`/`discountValue` que
 * `CreateSaleDto` — deliberadamente SIN `sucursalId`/`userId`/
 * `cashSessionId`/`paymentMethod`/`amountPaid`/`documentNumber`/`notes`:
 * ninguno de esos campos participa del calculo, y una cotizacion no crea
 * nada que los necesite. `sucursalId` SI lo necesita el motor de
 * promociones para evaluar vigencia por sucursal — lo resuelve
 * `sales.controller.ts` desde `req.user`, igual que `CreateSaleDto`.
 */
export interface CreateSaleQuoteDto {
  sucursalId: string;
  discountType?: SaleDiscountType;
  discountValue?: number;
  items: CreateSaleItemDto[];
}

/**
 * Un detalle de la cotizacion ya calculado — mismos nombres de campo que
 * `SaleItemResponse` para las magnitudes que tienen equivalente directo
 * (`quantity`/`unitPrice`/`taxRate`/`discount`/`lineSubtotal`/`lineTax`/
 * `lineTotal`), MAS `promotionDiscount` (el descuento automatico que ya
 * quedo incorporado en `lineSubtotal`, mostrado aparte para que quien
 * consuma la cotizacion pueda explicar de donde salio cada monto). Sin
 * `id` (no hay ningun `SaleItem` real) ni `product`/`tax` resueltos
 * (resumen de solo lectura, no forma parte del calculo — quien consuma
 * la cotizacion ya conoce esos datos por su cuenta, ej. el catalogo que
 * armo el propio carrito).
 */
export interface SaleQuoteItemResponse {
  productId: string;
  taxId: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  /** Suma de los descuentos automaticos que afectaron esta linea
   * (`PromotionApplicationLineResult.promotionDiscount`, Bloque P.5) — 0
   * si ninguna promocion aplico. */
  promotionDiscount: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  /** PROMO-09 (integracion de Pricing Analysis en Ventas): utilidad/
   * margen/aporte del proveedor/rentabilidad final de esta linea, ya
   * calculados sobre el precio ajustado por promociones y el costo
   * efectivo (`CostEngine`) del producto — ver
   * `shared/services/pricingAnalysis/`. `null` cuando no hay informacion
   * valida suficiente para calcularlo (mismo criterio que el resto del
   * coordinador: nunca lanza). Puramente informativo — no se persiste en
   * ningun lado todavia (ni `Sale`, ni `SaleItem`, ni reportes/dashboard),
   * unicamente se calcula y se expone en esta cotizacion. */
  profitabilityAnalysis: SaleQuoteLineProfitability | null;
}

/** PROMO-09: forma publica de `LineProfitabilityAnalysis`
 * (`shared/services/pricingAnalysis/`) — mismos campos, sin cambios; se
 * redeclara aca (en vez de reexportar el tipo del motor tal cual) mismo
 * criterio ya usado en todo el proyecto para desacoplar la capa HTTP de
 * un motor interno (ver `PromotionResponse`/`PromotionEffectType`). */
export interface SaleQuoteLineProfitability {
  quantity: number;
  salePrice: number;
  effectiveCost: number;
  profit: number;
  marginPercent: number | null;
  supplierContributionPerUnit: number;
  supplierContributionTotal: number;
  finalProfitability: number;
  finalProfitabilityTotal: number;
}

/**
 * Una promocion automatica aplicada, tal como la devuelve la cotizacion —
 * mismos campos que expondria `SaleAppliedPromotion` para el origen
 * `AUTOMATIC`, MENOS `id`/`createdAt`/`appliedByUser` (nada de eso existe
 * todavia, no hay fila persistida). `lineIndex`: posicion (0-based) de la
 * linea afectada dentro del array `items` que se envio a cotizar — `null`
 * si la promocion es de alcance `CART` (todo el carrito, sin linea
 * especifica), mismo significado que `saleItemId: null` en
 * `SaleAppliedPromotion`.
 */
export interface SaleQuoteAppliedPromotion {
  lineIndex: number | null;
  promotionId: string;
  promotionName: string;
  effectType: PromotionEffectType;
  effectValue: number | null;
  amountApplied: number;
}

/**
 * Resultado completo de cotizar una venta — CALCULO PURO, nada
 * persistido. Debe producir exactamente los mismos `subtotal`/`taxTotal`/
 * `discountTotal`/`total` que produciria `create()` si se confirmara la
 * MISMA venta con el mismo carrito (ver QA del Bloque P.7).
 */
export interface SaleQuoteResponse {
  items: SaleQuoteItemResponse[];
  subtotal: number;
  taxTotal: number;
  discountType: SaleDiscountType;
  discountValue: number;
  /** Descuento MANUAL de carrito (mismo campo que `Sale.discountTotal`). */
  discountTotal: number;
  /** Suma de TODOS los descuentos automaticos (de linea + de carrito) —
   * cifra informativa, ya incorporada en `subtotal`/`total`, no se resta
   * de nuevo (mismo criterio que
   * `PromotionApplicationTotals.promotionDiscountTotal`, Bloque P.5). */
  automaticDiscountTotal: number;
  appliedPromotions: SaleQuoteAppliedPromotion[];
  total: number;
}

/** Datos permitidos para actualizar una venta existente. Todos opcionales.
 * Los detalles (`items`) no se editan a traves de esta operacion, y por lo
 * tanto tampoco `subtotal`, `taxTotal`, `discountTotal` ni `total` (se
 * derivan de los detalles y solo se calculan al crear la venta).
 * `changeGiven` se recalcula automaticamente si se actualiza
 * `amountPaid`. */
export interface UpdateSaleDto {
  sucursalId?: string;
  userId?: string;
  cashSessionId?: string;
  documentNumber?: string | null;
  status?: SaleStatus;
  paymentMethod?: PaymentMethod;
  paymentReference?: string | null;
  saleDate?: Date;
  amountPaid?: number;
  notes?: string | null;
  /** Version 1.0.5, Bloque 1: asignar un cliente real a una venta creada
   * como "Publico General" — solo permitido antes de emitir su Factura
   * Electronica (ver guardas reales en `sales.service.ts::update()`). */
  customerId?: string | null;
}

/** Filtros de busqueda/listado disponibles para ventas. */
export interface ListSalesFilters {
  sucursalId?: string;
  userId?: string;
  cashSessionId?: string;
  status?: SaleStatus;
}

/** Parametros combinados para listar ventas: filtros + paginacion. */
export interface ListSalesQuery extends PaginationParams {
  filters?: ListSalesFilters;
}

/** Resultado de una operacion de listado paginado de ventas. */
export interface ListSalesResult {
  items: SaleResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven una unica venta. */
export interface SaleResult {
  sale: SaleResponse;
}

/**
 * Datos requeridos para anular una venta (Bloque 3, "Anulacion/Correccion
 * de Venta"). `reason` es obligatorio (a diferencia de `notes` en
 * `CreateSaleDto`/`UpdateSaleDto`, siempre opcional): anular es una accion
 * administrativa que exige justificacion, no una nota libre. `performedByUserId`
 * NO lo envia el cliente: lo resuelve `sales.controller.ts` desde `req.user`
 * (el administrador autenticado que ejecuta la accion), mismo criterio que
 * `sucursalId`/`userId` en `CreateSaleDto`.
 */
export interface VoidSaleDto {
  reason: string;
  performedByUserId: string;
}

/**
 * Datos requeridos para corregir una venta (Bloque 3). NO es un `PATCH`
 * sobre la venta original: `sales.service.ts` la anula (mismo efecto que
 * `voidSale`, motivo = `reason`) y crea una venta NUEVA con estos datos,
 * enlazada via `originalSaleId`. Misma forma que `CreateSaleItemDto`/los
 * campos editables de una venta — sin `sucursalId`/`userId`/`cashSessionId`/
 * `documentNumber`: la venta correctiva SIEMPRE hereda la sucursal y la
 * sesion de caja de la venta original (es una correccion de ESA venta, no
 * una venta nueva e independiente), un numero de documento nuevo se genera
 * igual que en `create()`, y `userId` es el administrador que corrige
 * (`performedByUserId`), no el cajero original.
 */
export interface CorrectSaleDto {
  reason: string;
  performedByUserId: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string | null;
  amountPaid?: number;
  notes?: string | null;
  discountType?: SaleDiscountType;
  discountValue?: number;
  items: CreateSaleItemDto[];
}

/** Resultado de corregir una venta: ambas puntas de la trazabilidad en una
 * sola respuesta, para que el frontend pueda mostrar de inmediato "esta
 * venta reemplaza a X" / "esta venta fue reemplazada por Y" sin una
 * segunda consulta. */
export interface CorrectSaleResult {
  original: SaleResponse;
  corrected: SaleResponse;
}
