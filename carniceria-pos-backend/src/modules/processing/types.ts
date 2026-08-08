/**
 * modules/processing/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de Despiece (Bloque 2 del plan v3 aprobado,
 * corregido tras la revision de mermas/costo/parentBatchId). SOLO formas de
 * datos: sin logica de negocio, sin consultas Prisma, sin validaciones (eso
 * vive en `service.ts`/`repository.ts`/`validation.ts`).
 *
 * Mismo criterio ya usado en `batches/types.ts`/`inventoryWaste/types.ts`:
 * los enums de Prisma se re-declaran localmente como union types, sin import
 * cruzado entre modulos.
 *
 * ARQUITECTURA APROBADA (plan v3 + correccion post-Bloque-2):
 *  - `ProcessingOperation` es el DOCUMENTO DE NEGOCIO de una operacion de
 *    despiece (canal/producto de entrada -> uno o mas cortes/subproductos de
 *    salida, mas una o mas lineas de merma). Vive en estado `DRAFT` mientras
 *    el cortador arma las lineas de salida y de merma; pasa a `COMPLETED` de
 *    forma atomica e INMUTABLE al confirmar (`complete()`, `service.ts`), o
 *    a `CANCELLED` sin tocar inventario.
 *  - `ProcessingOutputItem` es cada corte/subproducto resultante -- se
 *    persiste como fila real desde que se agrega (aunque la operacion siga
 *    `DRAFT`), editable/eliminable libremente hasta que la operacion se
 *    completa.
 *  - `ProcessingWasteItem` (correccion aprobada tras la revision del Bloque
 *    2): cada linea de merma REAL (hueso, grasa, recorte sin valor de venta)
 *    capturada explicitamente durante el DRAFT -- cantidad + motivo
 *    (`WasteReason`) + notas, mismo nivel de detalle que las lineas de
 *    salida. YA NO es un valor derivado implicito: el balance de la
 *    operacion es una IGUALDAD EXACTA,
 *    `inputQuantity === SUM(outputItems.quantity) + SUM(wasteLines.quantity)`,
 *    validada tanto en cada alta/edicion de linea (de cualquiera de los dos
 *    tipos) como de forma definitiva en `complete()`. Al completar, cada
 *    `ProcessingWasteItem` genera exactamente UNA `InventoryWaste` propia
 *    (`ProcessingOperation.wastes`, relacion ya existente desde el Bloque 1)
 *    -- ver `service.ts::complete`.
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Estado de una operacion de despiece (enum `ProcessingStatus` de `schema.prisma`). */
export type ProcessingStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

/** Unidad de medida del producto asociado (enum `UnitOfMeasure` de `schema.prisma`). */
export type ProcessingProductUnitOfMeasure = 'KILOGRAM' | 'UNIT';

/** Origen/motivo de una linea de merma (enum `WasteReason` de
 * `schema.prisma`) -- mismo catalogo controlado que `inventoryWaste/types.ts`,
 * re-declarado localmente por el mismo criterio de no-import-cruzado. */
export type ProcessingWasteReason =
  | 'RETURNED_NOT_RESTOCKED'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'PRODUCTION_ERROR'
  | 'CUTTING_ERROR'
  | 'PACKAGING_ERROR'
  | 'COLD_CHAIN_FAILURE'
  | 'PROCESSING_LOSS'
  | 'OTHER';

/** Resumen de producto reutilizado tanto para el producto de entrada como
 * para el de cada salida. */
export interface ProcessingProductSummary {
  id: string;
  name: string;
  sku: string | null;
  unitOfMeasure: ProcessingProductUnitOfMeasure;
}

/** Resumen de la sucursal asociada a una operacion. */
export interface ProcessingSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Resumen del usuario que registro/completo la operacion. */
export interface ProcessingUserSummary {
  id: string;
  fullName: string;
}

/** Forma de una linea de salida (corte/subproducto) tal como la expone el modulo. */
export interface ProcessingOutputItemResponse {
  id: string;
  processingOperationId: string;
  outputProductId: string;
  outputProduct: ProcessingProductSummary;
  quantity: number;
  /** Precio de venta del producto de salida, capturado como snapshot al
   * agregar la linea (nunca se relee `Product.salePrice` despues -- el
   * calculo de distribucion de costo debe ser estable, ver `service.ts`).
   * Puede ser 0 -- un subproducto sin precio de venta todavia definido
   * puede existir igual (ver `service.ts::complete`, regla de costeo). */
  salePriceSnapshot: number;
  /** Costo asignado por el metodo de valor relativo de venta -- `null`
   * mientras la operacion sigue `DRAFT` (se calcula recien en `complete()`). */
  allocatedCost: number | null;
  /** Lote de salida creado al completar -- `null` mientras la operacion
   * sigue `DRAFT`. */
  outputBatchId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Forma de una linea de merma (borrador, previo a materializarse como
 * `InventoryWaste` al completar) tal como la expone el modulo. */
export interface ProcessingWasteItemResponse {
  id: string;
  processingOperationId: string;
  reason: ProcessingWasteReason;
  quantity: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Forma de una operacion de despiece tal como la expone el modulo. */
export interface ProcessingOperationResponse {
  id: string;
  code: string;
  sucursalId: string;
  sucursal: ProcessingSucursalSummary;
  userId: string;
  user: ProcessingUserSummary;
  inputProductId: string;
  inputProduct: ProcessingProductSummary;
  inputBatchId: string | null;
  inputQuantity: number;
  inputUnitCost: number;
  status: ProcessingStatus;
  completedAt: Date | null;
  notes: string | null;
  outputItems: ProcessingOutputItemResponse[];
  wasteLines: ProcessingWasteItemResponse[];
  /** Ver nota de archivo: `inputQuantity - SUM(outputItems.quantity) -
   * SUM(wasteLines.quantity)`. Debe ser exactamente 0 para poder completar
   * la operacion (`complete()` revalida esto de forma definitiva) --
   * expuesto para que la UI lo muestre en vivo mientras se arma el DRAFT.
   * Puede ser negativo si las lineas ya cargadas superan la entrada (estado
   * transitorio e invalido, `complete()` lo rechaza). */
  balanceRemaining: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Datos requeridos para crear una operacion de despiece (`DRAFT`).
 * `performedByUserId` NO lo envia el cliente: lo resolveria el controller
 * desde `req.user` (mismo criterio que `CreateInventoryWasteDto`) --
 * todavia no existe ese controller en este bloque (Bloque 3), este tipo
 * queda preparado para cuando exista.
 *
 * `inputUnitCost` NO se recibe del cliente: `service.ts::create` lo resuelve
 * el mismo (costo real del lote si `inputBatchId` viene presente, costo de
 * referencia `Product.cost` en caso contrario) -- mismo criterio que
 * `CreateInventoryWasteDto.unitValue`, nunca un importe calculado enviado
 * por el cliente.
 */
export interface CreateProcessingOperationDto {
  sucursalId: string;
  performedByUserId: string;
  inputProductId: string;
  /**
   * Obligatorio POR REGLA DE NEGOCIO (no por el schema, que lo deja
   * nullable a proposito -- ver `prisma/schema.prisma`, seccion "MODULO DE
   * DESPIECE") cuando `Product.requiresBatch` es `true` para
   * `inputProductId`. Validado en `service.ts::create` -- nunca se permite
   * completar una operacion sobre un producto con trazabilidad de lote
   * obligatoria sin indicar de que lote proviene.
   */
  inputBatchId?: string | null;
  inputQuantity: number;
  notes?: string | null;
}

/** Datos permitidos para editar una operacion mientras sigue `DRAFT`
 * (`notes` unicamente -- los campos de origen/snapshot, igual que en
 * `UpdateBatchDto`, se fijan una unica vez al crear la operacion). */
export interface UpdateProcessingOperationDto {
  notes?: string | null;
}

/**
 * Datos requeridos para agregar una linea de salida (corte/subproducto) a
 * una operacion `DRAFT`. `salePriceSnapshot` NO se recibe del cliente: se
 * resuelve de `Product.salePrice` en el momento de agregar la linea (ver
 * nota de `ProcessingOutputItemResponse.salePriceSnapshot`).
 */
export interface AddProcessingOutputItemDto {
  outputProductId: string;
  quantity: number;
}

/** Datos permitidos para editar una linea de salida mientras la operacion
 * sigue `DRAFT` (solo la cantidad -- cambiar de producto equivale a
 * eliminar la linea y agregar una nueva, mismo criterio que Purchases/Sales
 * con sus lineas de detalle). */
export interface UpdateProcessingOutputItemDto {
  quantity: number;
}

/** Datos requeridos para agregar una linea de merma a una operacion
 * `DRAFT`. `reason` es obligatorio (catalogo controlado, mismo criterio que
 * `CreateInventoryWasteDto.reason`) -- no tiene un default implicito a nivel
 * de DTO aunque la columna de `schema.prisma` si lo tenga (`PROCESSING_LOSS`,
 * solo para no romper un eventual insert directo fuera de este servicio). */
export interface AddProcessingWasteItemDto {
  reason: ProcessingWasteReason;
  quantity: number;
  notes?: string | null;
}

/** Datos permitidos para editar una linea de merma mientras la operacion
 * sigue `DRAFT` -- a diferencia de las lineas de salida, motivo y notas SI
 * son editables (no identifican una entidad externa como `outputProductId`,
 * son puramente descriptivos de la propia linea). */
export interface UpdateProcessingWasteItemDto {
  reason?: ProcessingWasteReason;
  quantity?: number;
  notes?: string | null;
}

/** Filtros de busqueda/listado disponibles para operaciones de despiece. */
export interface ListProcessingOperationsFilters {
  sucursalId?: string;
  inputProductId?: string;
  status?: ProcessingStatus;
}

/** Parametros combinados para listar operaciones: filtros + paginacion. */
export interface ListProcessingOperationsQuery extends PaginationParams {
  filters?: ListProcessingOperationsFilters;
}

/** Resultado de una operacion de listado paginado de operaciones de despiece. */
export interface ListProcessingOperationsResult {
  items: ProcessingOperationResponse[];
  total: number;
}
