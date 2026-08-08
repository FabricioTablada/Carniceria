/**
 * features/sales/types/sale.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Sales (POS). Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/sales/types.ts` y `modules/sales/validation.ts`
 * (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`saleDate`,
 * `createdAt`, `updatedAt`) se tipan aqui como `string`, porque asi es como
 * viajan realmente por HTTP (JSON no tiene tipo `Date`; se serializan a ISO
 * string tanto en la respuesta del servidor como en lo que el cliente
 * envia). Mismo criterio ya usado en `user.types.ts`, `role.types.ts`,
 * `product.types.ts` y `category.types.ts`.
 *
 * NOTA (igual que en el backend): `Sale` no tiene campo `active` ni
 * endpoint de cambio de estado — el estado de una venta se maneja con
 * `status` (`SaleStatus`), editable via `UpdateSaleDto`.
 *
 * NOTA (igual que en el backend): `lineSubtotal`, `lineTax`, `lineTotal`,
 * `subtotal`, `taxTotal`, `discountTotal`, `total` y `changeGiven` nunca se
 * envian desde el cliente — los calcula el backend a partir de `quantity`,
 * `unitPrice`, `discount` y `amountPaid`. Por eso no aparecen en
 * `CreateSaleItemDto`, `CreateSaleDto` ni `UpdateSaleDto`, solo en `Sale`.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */
import type { PromotionEffectType } from '@/features/promotions/types/promotion.types'

/** Estado de la venta (enum `SaleStatus` de schema.prisma). */
export type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'REFUNDED'

/** Metodo de pago (enum `PaymentMethod` de schema.prisma). */
export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'SINPE_MOVIL'
  | 'TRANSFER'
  | 'MIXED'

/** Estado de la sesion de caja (enum `CashSessionStatus` de schema.prisma). */
export type CashSessionStatus = 'OPEN' | 'CLOSED'

/** Tipo de descuento de carrito (enum `SaleDiscountType` de schema.prisma).
 * Distinto de `SaleItem.discount` (descuento por linea). */
export type SaleDiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED'

/** Unidad de medida del producto (enum `UnitOfMeasure` de schema.prisma). */
export type SaleItemProductUnitOfMeasure = 'KILOGRAM' | 'UNIT'

/** Resumen del producto de un detalle de venta (Bloque 3, "Detalle de
 * Venta"): nombre/SKU/unidad, resuelto por el backend — no solo el id. */
export interface SaleItemProductSummary {
  id: string
  name: string
  sku: string | null
  unitOfMeasure: SaleItemProductUnitOfMeasure
}

/** Resumen del impuesto de un detalle de venta (Bloque 3). */
export interface SaleItemTaxSummary {
  id: string
  name: string
}

/**
 * Detalle de venta tal como lo expone el backend (`SaleItemResponse`).
 * `unitPrice` y `discount` son los valores recibidos del cliente;
 * `taxRate`, `lineSubtotal`, `lineTax` y `lineTotal` son un snapshot
 * calculado por el backend al momento de la venta. `product`/`tax`
 * (Bloque 3): resumen ya resuelto por el backend, no solo el id crudo.
 */
export interface SaleItem {
  id: string
  productId: string
  taxId: string | null
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
  lineSubtotal: number
  lineTax: number
  lineTotal: number
  /** Bloque 14.2 (Costos Base): snapshot de `Product.cost` al momento de
   * la venta. `null` unicamente en ventas creadas antes de este bloque
   * (costo historico desconocido). Sin uso todavia en el POS. */
  unitCost: number | null
  product: SaleItemProductSummary
  tax: SaleItemTaxSummary | null
}

/** Resumen minimo de una venta relacionada (original o correctiva),
 * Bloque 3 ("Anulacion/Correccion de Venta"). */
export interface RelatedSaleSummary {
  id: string
  documentNumber: string | null
  status: SaleStatus
}

/** Origen de un descuento aplicado (Bloque P.1/P.2, Motor de Promociones).
 * Hoy solo existe `MANUAL`; `AUTOMATIC` queda preparado para cuando exista
 * un motor de reglas de promociones. */
export type PromotionSource = 'MANUAL' | 'AUTOMATIC'

/** Resumen del usuario que aplico un descuento manual. `null` cuando el
 * descuento fue automatico (todavia sin implementar). */
export interface SaleAppliedPromotionUserSummary {
  id: string
  fullName: string
}

/**
 * Un descuento REALMENTE aplicado a la venta (Bloque P.2, expone
 * `SaleAppliedPromotion`). Es un registro de auditoria — que ocurrio,
 * cuanto impacto, quien o que lo origino — no una regla de negocio
 * configurable (eso vive en un futuro catalogo `Promotion`, sin
 * implementar). `saleItemId`: `null` = descuento de carrito completo (el
 * unico caso real hoy); un id real ligaria el descuento a una linea
 * especifica (promociones automaticas futuras por producto/combo).
 */
export interface SaleAppliedPromotion {
  id: string
  saleItemId: string | null
  source: PromotionSource
  promotionNameSnapshot: string
  discountType: SaleDiscountType
  discountValue: number
  amountApplied: number
  appliedByUser: SaleAppliedPromotionUserSummary | null
  createdAt: string
  /** Deuda tecnica del motor de promociones, Bloque 5 (consumo en el
   * frontend): complementan, sin reemplazar, `discountType`/
   * `promotionNameSnapshot` de arriba. Preservan el tipo real de la
   * regla y el id de catalogo que la origino. `null` para descuentos
   * MANUALES y para ventas creadas antes de que el backend empezara a
   * poblarlos (Bloque 3) — ver `SaleDetailContent.tsx` para el fallback. */
  effectType: PromotionEffectType | null
  promotionId: string | null
}

/**
 * Venta tal como la expone el backend (`SaleResponse`). `subtotal`,
 * `taxTotal`, `discountTotal`, `total` y `changeGiven` son calculados por
 * el backend; nunca se reciben del cliente.
 */
export interface Sale {
  id: string
  sucursalId: string
  userId: string
  cashSessionId: string
  documentNumber: string | null
  status: SaleStatus
  paymentMethod: PaymentMethod
  /** Referencia del pago electronico (QA-007): numero de autorizacion/
   * voucher de tarjeta, comprobante SINPE o numero de transferencia. Nula
   * para CASH (y para MIXED, fuera del alcance de esta regla). */
  paymentReference: string | null
  saleDate: string
  subtotal: number
  taxTotal: number
  discountType: SaleDiscountType
  discountValue: number
  discountTotal: number
  total: number
  amountPaid: number
  changeGiven: number
  notes: string | null
  sucursal: {
    id: string
    code: string
    name: string
  }
  user: {
    id: string
    fullName: string
  }
  cashSession: {
    id: string
    status: CashSessionStatus
  }
  /** Bloque 8.3: cliente asociado a la venta (módulo de Clientes, Bloque
   * 8.2) — `null` = "Público General" (comportamiento por defecto). */
  customerId: string | null
  customer: {
    id: string
    name: string
    identificationType: string
    identificationNumber: string
    /** Bloque 8.4: usado para reenviar el comprobante automáticamente sin
     * pedir el correo a mano — `null` si el cliente no tiene uno cargado. */
    email: string | null
  } | null
  items: SaleItem[]
  /** Bloque P.2 (Motor de Promociones, exposicion de la auditoria): cada
   * descuento realmente aplicado a esta venta — hoy, a lo sumo uno (el
   * descuento manual de carrito, Bloque P.1). Complementa, no reemplaza,
   * a `discountType`/`discountValue`/`discountTotal` (que siguen siendo
   * el agregado ya calculado, sin cambios). */
  appliedPromotions: SaleAppliedPromotion[]
  /** Trazabilidad de correccion (Bloque 3): si esta venta es una venta
   * CORRECTIVA, `originalSale` referencia la venta que reemplaza. Si esta
   * venta YA FUE corregida, `correctedBySale` referencia la venta
   * correctiva que la reemplaza. */
  originalSaleId: string | null
  originalSale: RelatedSaleSummary | null
  correctedBySaleId: string | null
  correctedBySale: RelatedSaleSummary | null
  /** Bloque 7.16: lectura del resultado de la emisión electrónica en
   * Alegra (backend `modules/integrations/alegra`) — `null` mientras no
   * se emitió (o si Alegra no está configurado). Se usa únicamente para
   * saber si ya existe un documento electrónico descargable. */
  alegraInvoiceId: string | null
  alegraInvoiceStatus: string | null
  alegraElectronicKey: string | null
  /** Version 1.0.5, Bloque 1: mismo criterio que los 3 campos de arriba —
   * `null` salvo que una emisión haya quedado en estado incierto tras un
   * timeout de red (ver `alegra.service.ts::emitInvoice`). Se usa para
   * ocultar el botón "Asignar cliente" en ese estado. */
  alegraEmissionUncertainAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un detalle de venta dentro de
 * `CreateSaleDto`. Coincide exactamente con el `CreateSaleItemSchema`
 * (Zod) del backend: el cliente solo declara producto, impuesto (si
 * aplica), cantidad, precio unitario y descuento de linea; los importes
 * de linea los calcula el backend.
 */
export interface CreateSaleItemDto {
  productId: string
  taxId?: string | null
  quantity: number
  unitPrice: number
  discount?: number
}

/**
 * Datos requeridos para crear una venta junto con sus detalles.
 * Coincide exactamente con `CreateSaleSchema` (Zod) del backend:
 * `documentNumber`/`notes` son `.nullish()`; `status`, `paymentMethod`,
 * `saleDate` y `amountPaid` son `.optional()`. Los totales de la venta no
 * se envian: el backend los calcula a partir de `items` y `amountPaid`.
 *
 * `sucursalId` y `userId` NO forman parte de este DTO: el backend los
 * resuelve automaticamente desde `req.user` (JWT, via
 * `authenticate.middleware.ts`) dentro de `sales.controller.ts`, en vez de
 * recibirlos del cliente. Ver `modules/sales/validation.ts` y
 * `modules/sales/controller.ts` del backend.
 */
export interface CreateSaleDto {
  cashSessionId: string
  /** Bloque 8.3: cliente seleccionado en el POS — `null`/ausente =
   * "Público General" (comportamiento por defecto). */
  customerId?: string | null
  documentNumber?: string | null
  status?: SaleStatus
  paymentMethod?: PaymentMethod
  /** Requerida por `CreateSaleSchema` cuando `paymentMethod` es
   * CARD/SINPE_MOVIL/TRANSFER (QA-007); no se envia para CASH. */
  paymentReference?: string | null
  saleDate?: string
  amountPaid?: number
  notes?: string | null
  /** Descuento de carrito (no de linea): `discountValue` es el numero tal
   * como lo ingreso el cajero (10 = 10% si es PERCENTAGE, 500 = ₡500 si es
   * FIXED). El monto ya calculado (`discountTotal`) y el `total` final los
   * calcula siempre el backend, nunca se envian. */
  discountType?: SaleDiscountType
  discountValue?: number
  items: CreateSaleItemDto[]
}

/**
 * Datos requeridos para cotizar una venta (Bloque P.8, `POST /sales/quote`).
 * Mismos `items`/`discountType`/`discountValue` que `CreateSaleDto` —
 * deliberadamente SIN `cashSessionId`/`paymentMethod`/`amountPaid`/etc.
 * (una cotizacion no crea nada que los necesite) y SIN `sucursalId`: el
 * backend la resuelve desde el usuario autenticado (`req.user`), igual que
 * en `create()` — nunca se acepta del cliente, ni siquiera para cotizar
 * (mismo criterio ya documentado en `modules/sales/types.ts` del backend,
 * `CreateSaleQuoteDto`).
 */
export interface CreateSaleQuoteDto {
  discountType?: SaleDiscountType
  discountValue?: number
  items: CreateSaleItemDto[]
}

/**
 * Un detalle de la cotizacion ya calculado — mismos nombres de campo que
 * `SaleItem` para las magnitudes con equivalente directo
 * (`quantity`/`unitPrice`/`taxRate`/`discount`/`lineSubtotal`/`lineTax`/
 * `lineTotal`), MAS `promotionDiscount` (el descuento automatico que ya
 * quedo incorporado en `lineSubtotal`). Sin `id` (no hay ningun `SaleItem`
 * real todavia) ni `product`/`tax` resueltos (quien consuma la cotizacion
 * ya conoce esos datos por su cuenta: es el mismo carrito que armo).
 *
 * CONTRATO DE ORDEN (verificado contra `modules/sales/service.ts`,
 * `getQuote()`, backend): `SaleQuoteResponse.items[i]` corresponde SIEMPRE
 * a `CreateSaleQuoteDto.items[i]` que se envio a cotizar — la cadena
 * `dto.items` -> `computeItems()` -> `getQuote()` son tres `Array.map()`
 * encadenados, sin ningun `.sort()`/`.filter()`/reordenamiento asincrono
 * entre medio. Ademas, `SaleQuoteAppliedPromotion.lineIndex` esta
 * explicitamente documentado (backend) como "posicion dentro del array
 * `items` que se envio a cotizar" — el propio contrato de la API asume y
 * declara ese orden. Por eso el frontend puede correlacionar cada
 * `SaleQuoteItemResponse` con su `CartLine` de origen por POSICION
 * (indice), sin necesitar un id de linea adicional.
 */
export interface SaleQuoteItemResponse {
  productId: string
  taxId: string | null
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
  promotionDiscount: number
  lineSubtotal: number
  lineTax: number
  lineTotal: number
}

/**
 * Una promocion automatica aplicada, tal como la devuelve la cotizacion —
 * mismos campos que expondria `SaleAppliedPromotion` para el origen
 * `AUTOMATIC`, MENOS `id`/`createdAt`/`appliedByUser` (nada de eso existe
 * todavia, no hay fila persistida). `lineIndex`: posicion (0-based) de la
 * linea afectada dentro de `CreateSaleQuoteDto.items` — `null` si la
 * promocion es de alcance `CART` (todo el carrito, sin linea especifica).
 */
export interface SaleQuoteAppliedPromotion {
  lineIndex: number | null
  promotionId: string
  promotionName: string
  effectType: PromotionEffectType
  effectValue: number | null
  amountApplied: number
}

/**
 * Resultado completo de cotizar una venta (Bloque P.8) — CALCULO PURO,
 * nada persistido. Debe producir exactamente los mismos `subtotal`/
 * `taxTotal`/`discountTotal`/`total` que produciria `createSale()` si se
 * confirmara la MISMA venta con el mismo carrito (contrato verificado en
 * el QA del Bloque P.7/cierre de defectos, backend).
 */
export interface SaleQuoteResponse {
  items: SaleQuoteItemResponse[]
  subtotal: number
  taxTotal: number
  discountType: SaleDiscountType
  discountValue: number
  /** Descuento MANUAL de carrito (mismo campo que `Sale.discountTotal`). */
  discountTotal: number
  /** Suma de TODOS los descuentos automaticos (de linea + de carrito) —
   * cifra informativa, ya incorporada en `subtotal`/`total`, no se resta
   * de nuevo. */
  automaticDiscountTotal: number
  appliedPromotions: SaleQuoteAppliedPromotion[]
  total: number
}

/**
 * Datos permitidos para actualizar una venta existente. Coincide
 * exactamente con `UpdateSaleSchema` (Zod) del backend: todos los campos
 * opcionales. Los detalles (`items`) no se editan por esta via, y por lo
 * tanto tampoco los totales derivados de ellos.
 */
export interface UpdateSaleDto {
  sucursalId?: string
  userId?: string
  cashSessionId?: string
  documentNumber?: string | null
  status?: SaleStatus
  paymentMethod?: PaymentMethod
  paymentReference?: string | null
  saleDate?: string
  amountPaid?: number
  notes?: string | null
  /** Version 1.0.5, Bloque 1: asignar un cliente real a una venta creada
   * como "Publico General" — solo antes de emitir su Factura Electronica
   * (el backend responde 409 si ya tiene `alegraInvoiceId`, emisión
   * incierta, o está anulada — ver `sales.service.ts::update()`). */
  customerId?: string | null
}

/**
 * Filtros de listado de ventas.
 * Coincide exactamente con `ListSalesFilters` del backend: mismos nombres
 * y mismos tipos.
 */
export interface SaleFilters {
  sucursalId?: string
  userId?: string
  cashSessionId?: string
  status?: SaleStatus
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 4:
   * ahora si se usa en `SalesPage.tsx` (antes esta pagina nunca la
   * enviaba, quedando fija en la primera pagina). */
  page?: number
  /** Tamaño de pagina. `CashSessionDetailPage.tsx` (Reportes) la usa para
   * traer todas las ventas de una sesion puntual en una sola pagina,
   * mismo criterio ya aplicado a `PermissionFilters.limit` — sin relacion
   * con la paginacion real de `SalesPage.tsx`. */
  limit?: number
}

/**
 * Respuesta real de GET /sales.
 * El controlador (`sales/controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedSalesResponse {
  success: true
  data: Sale[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/** Datos requeridos para anular una venta (Bloque 3). `reason` es
 * obligatorio: anular es una accion administrativa que exige
 * justificacion, a diferencia de `notes` (siempre opcional). */
export interface VoidSaleDto {
  reason: string
}

/** Datos requeridos para corregir una venta (Bloque 3). NO es un `PATCH`
 * sobre la venta original: el backend la anula y crea una venta nueva con
 * estos datos, enlazada via `originalSaleId` — por eso no incluye
 * `sucursalId`/`userId`/`cashSessionId`/`documentNumber` (la venta
 * correctiva siempre hereda sucursal y sesion de caja de la original). */
export interface CorrectSaleDto {
  reason: string
  paymentMethod?: PaymentMethod
  paymentReference?: string | null
  amountPaid?: number
  notes?: string | null
  discountType?: SaleDiscountType
  discountValue?: number
  items: CreateSaleItemDto[]
}

/** Resultado de corregir una venta: ambas puntas de la trazabilidad. */
export interface CorrectSaleResult {
  original: Sale
  corrected: Sale
}