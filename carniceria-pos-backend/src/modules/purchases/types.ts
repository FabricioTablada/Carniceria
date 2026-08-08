/**
 * modules/purchases/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de compras.
 * Define unicamente las formas de datos que consumen `purchases.service.ts`,
 * `purchases.repository.ts` y `purchases.controller.ts`; no contiene logica
 * de negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `purchases.service.ts`, `purchases.repository.ts` y
 * `purchases.validation.ts`).
 *
 * NOTA: el modelo `Purchase` de `schema.prisma` no tiene campo `active` ni
 * ninguna restriccion `@@unique`, por lo que este modulo no expone cambio de
 * estado ni validacion de duplicados (a diferencia de Categories, Products,
 * Taxes y Suppliers).
 *
 * REGLA CRITICA: `lineSubtotal`, `lineTax`, `lineTotal`, `subtotal`,
 * `taxTotal` y `total` NUNCA se reciben del cliente. Un backend de POS no
 * puede confiar en totales calculados por el frontend; estos valores los
 * calcula siempre `purchases.service.ts` a partir de `quantity`, `unitCost`
 * y la tasa del impuesto almacenada en la base de datos. Por eso no existen
 * en `CreatePurchaseItemDto`, `CreatePurchaseDto` ni `UpdatePurchaseDto`:
 * solo aparecen en las formas de respuesta (`PurchaseItemResponse`,
 * `PurchaseResponse`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Estado de la compra (enum `PurchaseStatus` de `schema.prisma`). */
export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED';

/** Resumen de la sucursal asociada a una compra. */
export interface PurchaseSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Resumen del proveedor asociado a una compra. */
export interface PurchaseSupplierSummary {
  id: string;
  name: string;
}

/** Resumen del usuario que registro la compra. */
export interface PurchaseUserSummary {
  id: string;
  fullName: string;
}

/** Unidad de medida del producto (enum `UnitOfMeasure` de `schema.prisma`),
 * mismo criterio que `SaleItemProductUnitOfMeasure` (`modules/sales/types.ts`). */
export type PurchaseItemProductUnitOfMeasure = 'KILOGRAM' | 'UNIT';

/** Resumen del producto de un detalle de compra -- nombre/SKU/unidad para
 * mostrar la linea (ej. en el Motor de Documentos, `PURCHASE_ORDER`) sin un
 * lookup aparte. Mismo criterio que `SaleItemProductSummary`. */
export interface PurchaseItemProductSummary {
  id: string;
  name: string;
  sku: string | null;
  unitOfMeasure: PurchaseItemProductUnitOfMeasure;
}

/** Resumen del impuesto de un detalle de compra. Mismo criterio que
 * `SaleItemTaxSummary`. */
export interface PurchaseItemTaxSummary {
  id: string;
  name: string;
}

/** Forma de un detalle de compra tal como lo expone el modulo. `unitCost` es
 * el valor recibido del cliente; `taxRate`, `lineSubtotal`, `lineTax` y
 * `lineTotal` son SNAPSHOT calculados por el servicio al momento de la
 * compra. */
export interface PurchaseItemResponse {
  id: string;
  productId: string;
  taxId: string | null;
  quantity: number;
  unitCost: number;
  taxRate: number;
  /** Bloque COST-06.1 (merma por linea de compra): merma esperada de ESTE
   * lote/recepcion especifica — independiente de
   * `Product.expectedWastePercent` (el valor POR DEFECTO del producto,
   * que este campo nunca modifica). `null` cuando la linea no la
   * especifico. Puramente informativo: no participa todavia de ningun
   * calculo (`CostEngine`, Ventas, Reportes, Dashboard). */
  expectedWastePercent: number | null;
  /** Bloque LOTES-09 (integracion completa con Compras): trazabilidad del
   * lote de ESTA recepcion, propagada tal cual (`createBatchesForReceivedPurchase`)
   * al `Batch` creado automaticamente cuando el producto tiene
   * `Product.requiresBatch`. `null` cuando la linea no la especifico (o el
   * producto no usa lotes). */
  supplierLotCode: string | null;
  productionDate: Date | null;
  expiryDate: Date | null;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  /** Bloque Motor de Documentos (PURCHASE_ORDER): resumen de producto/
   * impuesto, mismo criterio que `SaleItemResponse.product`/`.tax`
   * (`modules/sales/types.ts`) -- necesario para que un `DocumentBuilder`
   * (o cualquier otra vista) muestre el nombre de la linea sin resolverlo
   * aparte. `tax` es `null` cuando la linea no tiene impuesto. */
  product: PurchaseItemProductSummary;
  tax: PurchaseItemTaxSummary | null;
}

/** Forma de una compra tal como la expone el modulo hacia el resto de la app.
 * `subtotal`, `taxTotal` y `total` son calculados por el servicio a partir
 * de los detalles; nunca se reciben del cliente. */
export interface PurchaseResponse {
  id: string;
  sucursalId: string;
  supplierId: string;
  userId: string;
  documentNumber: string | null;
  status: PurchaseStatus;
  purchaseDate: Date;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  sucursal: PurchaseSucursalSummary;
  supplier: PurchaseSupplierSummary;
  user: PurchaseUserSummary;
  items: PurchaseItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un detalle de compra dentro de
 * `CreatePurchaseDto`. El cliente solo declara el producto, el impuesto (si
 * aplica), la cantidad y el costo unitario; `lineSubtotal`, `lineTax` y
 * `lineTotal` los calcula el servicio. */
export interface CreatePurchaseItemDto {
  productId: string;
  taxId?: string | null;
  quantity: number;
  unitCost: number;
  /** Bloque COST-06.1: opcional, ver `PurchaseItemResponse.expectedWastePercent`. */
  expectedWastePercent?: number | null;
  /** Bloque LOTES-09: opcionales, ver `PurchaseItemResponse.supplierLotCode`/
   * `productionDate`/`expiryDate`. Solo tienen sentido de negocio cuando el
   * producto de esta linea tiene `Product.requiresBatch = true` -- el
   * frontend decide cuando mostrar estos campos (ver
   * `ProductLookupItem.requiresBatch`), pero el backend no lo exige: si se
   * envian para un producto sin lotes, simplemente se persisten en la
   * linea sin ningun efecto (no se crea `Batch`, ver
   * `createBatchesForReceivedPurchase`). */
  supplierLotCode?: string | null;
  productionDate?: Date | null;
  expiryDate?: Date | null;
}

/** Datos requeridos para crear una compra junto con sus detalles.
 * `subtotal`, `taxTotal` y `total` los calcula el servicio a partir de
 * `items`; el cliente no los envia. */
export interface CreatePurchaseDto {
  sucursalId: string;
  supplierId: string;
  userId: string;
  documentNumber?: string | null;
  status?: PurchaseStatus;
  purchaseDate?: Date;
  notes?: string | null;
  items: CreatePurchaseItemDto[];
}

/** Datos permitidos para actualizar una compra existente. Todos opcionales.
 * Los detalles (`items`) no se editan a traves de esta operacion, y por lo
 * tanto tampoco `subtotal`, `taxTotal` ni `total` (se derivan de los
 * detalles y solo se recalculan al crear la compra). */
export interface UpdatePurchaseDto {
  supplierId?: string;
  documentNumber?: string | null;
  status?: PurchaseStatus;
  purchaseDate?: Date;
  notes?: string | null;
}

/** Filtros de busqueda/listado disponibles para compras. */
export interface ListPurchasesFilters {
  sucursalId?: string;
  supplierId?: string;
  status?: PurchaseStatus;
}

/** Parametros combinados para listar compras: filtros + paginacion. */
export interface ListPurchasesQuery extends PaginationParams {
  filters?: ListPurchasesFilters;
}

/** Resultado de una operacion de listado paginado de compras. */
export interface ListPurchasesResult {
  items: PurchaseResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven una unica compra. */
export interface PurchaseResult {
  purchase: PurchaseResponse;
}
