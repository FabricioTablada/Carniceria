/**
 * modules/inventoryWaste/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de Mermas (Bloque 5.2 — infraestructura
 * base, ver analisis de los Bloques 5/5.1). SOLO formas de datos: sin
 * logica de negocio, sin consultas Prisma, sin validaciones (eso vivira en
 * `inventoryWaste.validation.ts`). Este bloque no crea
 * `service.ts`/`repository.ts`/`controller.ts`/`routes.ts` — ningun
 * endpoint todavia.
 *
 * Mismo criterio ya usado en `sales.types.ts`/`returns/types.ts`: los
 * enums de Prisma se re-declaran localmente como union types, sin import
 * cruzado entre modulos.
 *
 * ARQUITECTURA APROBADA (Bloque 5.1): `InventoryWaste` es el DOCUMENTO DE
 * NEGOCIO que representa el evento de merma — NO reemplaza a
 * `InventoryMovement` (tipo `WASTE`, ya existente), que sigue siendo el
 * UNICO responsable de modificar `Inventory.quantity`. Mismo patron ya
 * usado por `Sale`/`SaleReturn`: cada uno con su propio movimiento de
 * inventario aparte, nunca el modelo de negocio escribiendo el stock
 * directamente.
 *
 * `unitValue`/`totalValue` (ver analisis del Bloque 5.1, "Valorizacion"):
 * snapshot del costo de referencia del producto (`Product.cost`) al
 * momento de la merma — NUNCA el precio de venta (sobreestimaria el
 * impacto real de la perdida) ni un costo promedio ponderado (el sistema
 * no lo calcula todavia). El servicio que calcule esto (todavia no
 * implementado) es quien resuelve `Product.cost` y multiplica por
 * `quantity`; el cliente nunca los envia.
 *
 * `sourceReturnItemId` (ver analisis del Bloque 5, "Relacion con
 * devoluciones"): cuando una linea de devolucion no vuelve a stock
 * vendible (`restock: false`, Bloque 4.2), deberia generar
 * automaticamente esta relacion — sin logica de negocio en este bloque,
 * nada la genera todavia. Opcional: una merma tambien puede originarse sin
 * ninguna devolucion de por medio (producto vencido/dañado detectado
 * directamente en inventario).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Origen/causa de una merma (enum `WasteReason` de `schema.prisma`).
 * Catalogo controlado (a diferencia de `InventoryMovement.reason`, texto
 * libre) para que los reportes de mermas puedan agruparse de forma
 * confiable (ver analisis del Bloque 5.1). `PRODUCTION_ERROR`/
 * `COLD_CHAIN_FAILURE`: preparados desde ahora, sin flujo especial
 * todavia (ver analisis del Bloque 5, seccion 3). */
export type WasteReason =
  | 'RETURNED_NOT_RESTOCKED'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'PRODUCTION_ERROR'
  | 'CUTTING_ERROR'
  | 'PACKAGING_ERROR'
  | 'COLD_CHAIN_FAILURE'
  | 'OTHER';

/** Unidad de medida del producto (enum `UnitOfMeasure` de `schema.prisma`).
 * Declarada localmente, mismo criterio que `reports.types.ts`/
 * `sales/types.ts`. */
export type InventoryWasteProductUnitOfMeasure = 'KILOGRAM' | 'UNIT';

/**
 * Datos requeridos para registrar una merma. `performedByUserId` NO lo
 * envia el cliente: lo resolveria el controller desde `req.user` (mismo
 * criterio que `VoidSaleDto`/`CreateSaleReturnDto`) — todavia no existe
 * ese controller en este bloque, este tipo queda preparado para cuando
 * exista. `unitValue`/`totalValue` tampoco se reciben del cliente: los
 * calcularia el servicio a partir de `Product.cost`, mismo criterio que
 * `CreateSaleItemDto`/`CreateSaleReturnItemDto` (el cliente nunca envia
 * importes calculados).
 */
export interface CreateInventoryWasteDto {
  sucursalId: string;
  productId: string;
  performedByUserId: string;
  reason: WasteReason;
  notes?: string | null;
  quantity: number;
  /** Ver nota de archivo, "Relacion con devoluciones". Opcional: una merma
   * puede no originarse en ninguna devolucion. */
  sourceReturnItemId?: string | null;
  /**
   * Bloque LOTES-05 (Modulo de Lotes, integracion con Mermas): id del lote
   * especifico del que se descuenta esta merma, cuando el producto tiene
   * `Product.requiresBatch`. Opcional: un producto sin lotes nunca lo
   * envia (`inventoryWaste.service.ts` no exige este campo para ningun
   * producto -- el llamador decide si aplica). Cuando se envia, debe
   * pertenecer al mismo `productId`/`sucursalId` de esta merma y tener
   * `availableQuantity >= quantity` (validado dentro de la transaccion,
   * releyendo el lote, mismo criterio que el stock agregado de
   * `Inventory`) -- se permite mermar de un lote `ACTIVE`, `EXPIRED` o
   * `BLOCKED` (un `DEPLETED` nunca tiene saldo suficiente): dar de baja
   * stock vencido o bloqueado es exactamente el proposito de una merma.
   */
  batchId?: string | null;
}

/** Resumen de la sucursal asociada a una merma. */
export interface InventoryWasteSucursalSummary {
  id: string;
  name: string;
}

/** Resumen del producto asociado a una merma. */
export interface InventoryWasteProductSummary {
  id: string;
  name: string;
  sku: string | null;
  unitOfMeasure: InventoryWasteProductUnitOfMeasure;
}

/** Resumen del usuario que registro la merma. */
export interface InventoryWasteUserSummary {
  id: string;
  fullName: string;
}

/**
 * Forma de una merma tal como la expondria el modulo hacia el resto de la
 * app. `totalValue` es `quantity * unitValue`, calculado por el servicio;
 * nunca se recibe del cliente.
 */
export interface InventoryWasteResponse {
  id: string;
  sucursalId: string;
  productId: string;
  userId: string;
  reason: WasteReason;
  notes: string | null;
  quantity: number;
  unitValue: number;
  totalValue: number;
  sourceReturnItemId: string | null;
  /** Bloque LOTES-05: ver `CreateInventoryWasteDto.batchId`. `null` para
   * mermas de productos sin lotes o registradas antes de este bloque. */
  batchId: string | null;
  sucursal: InventoryWasteSucursalSummary;
  product: InventoryWasteProductSummary;
  user: InventoryWasteUserSummary;
  createdAt: Date;
  updatedAt: Date;
}

/** Filtros de busqueda/listado disponibles para mermas (para un futuro
 * `GET /inventory-wastes` o equivalente, todavia sin implementar — ver
 * analisis del Bloque 5, "NO crear un modulo separado fuera de
 * Inventario"). */
export interface ListInventoryWastesFilters {
  sucursalId?: string;
  productId?: string;
  userId?: string;
  reason?: WasteReason;
}

/** Parametros combinados para listar mermas: filtros + paginacion. */
export interface ListInventoryWastesQuery extends PaginationParams {
  filters?: ListInventoryWastesFilters;
}

/** Resultado de una operacion de listado paginado de mermas. */
export interface ListInventoryWastesResult {
  items: InventoryWasteResponse[];
  total: number;
}
