/**
 * modules/returns/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de devoluciones. Base creada en el Bloque
 * 4.1 (infraestructura), extendida en el Bloque 4.2 con la logica de
 * negocio real (`service.ts`/`repository.ts`/`controller.ts`/`routes.ts`).
 * Este archivo sigue siendo SOLO formas de datos: sin logica de negocio,
 * sin consultas Prisma (eso vive en `returns.repository.ts`/
 * `returns.service.ts`).
 *
 * Mismo criterio ya usado en `reports.types.ts`/`sales.types.ts`: los enums
 * de Prisma (`PaymentMethod`, `SyncStatus`) se re-declaran localmente como
 * tipos union, sin import cruzado entre modulos.
 *
 * NOTA (ver analisis del Bloque 4): una venta puede tener VARIAS
 * devoluciones (parciales). `SaleReturnItem.saleItemId` enlaza cada linea
 * devuelta a la linea de venta original que reduce — la suma de
 * `quantity` de todas las devoluciones de una misma `saleItemId` nunca debe
 * superar la `quantity` original de esa `SaleItem`; esa validacion es logica
 * de negocio y NO existe todavia (queda para un bloque posterior).
 *
 * NOTA: `refundMethod` reutiliza `PaymentMethod` porque el reembolso puede
 * ser en un medio distinto al de pago original de la venta (decision de
 * negocio pendiente, ver analisis del Bloque 4) — no se asume que coincide.
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Metodo de pago / reembolso (enum `PaymentMethod` de `schema.prisma`). */
export type PaymentMethod = 'CASH' | 'CARD' | 'SINPE_MOVIL' | 'TRANSFER' | 'MIXED';

/**
 * Datos requeridos para declarar una linea de devolucion. El cliente solo
 * declara que `SaleItem` se devuelve y cuanto — `unitPrice`/`lineTotal`
 * (snapshot) los calculara el servicio a partir de la linea de venta
 * original, mismo criterio que `CreateSaleItemDto` (el cliente nunca envia
 * importes calculados).
 *
 * `restock` (Bloque 4.2, ver analisis del Bloque 4): decision de negocio
 * TODAVIA no cerrada sobre si un producto devuelto vuelve a stock vendible
 * o se marca como merma/no reincorporable. Se deja el punto preparado sin
 * forzar que TODA devolucion incremente el stock automaticamente: si es
 * `true` (u omitido — hoy `true` es el default asumido, no una regla de
 * negocio confirmada), `returns.service.ts` emite el `InventoryMovement`
 * de tipo `RETURN`; si es `false`, lo omite. Esta eleccion NO se persiste
 * todavia por linea (`SaleReturnItem` no tiene un campo para ello — ver
 * nota en `returns.repository.ts`); solo gobierna si el movimiento de
 * inventario se emite o no en el momento.
 */
export interface CreateSaleReturnItemDto {
  saleItemId: string;
  quantity: number;
  restock?: boolean;
}

/**
 * Datos requeridos para registrar una devolucion contra una venta.
 * `saleId` SI forma parte de este DTO (a diferencia de `VoidSaleDto`/
 * `CorrectSaleDto` en `sales/types.ts`, donde la venta viaja en la ruta):
 * el modulo de devoluciones se monta bajo su propio prefijo (`/returns`,
 * mismo criterio de un router por modulo que el resto del sistema —
 * `sales`/`cash`/`purchases`, etc. — ver `modules/index.ts`), no anidado
 * bajo `/sales`, asi que la venta referenciada viaja en el body.
 * `performedByUserId` NO lo envia el cliente: lo resuelve el controller
 * desde `req.user` (el usuario autenticado que procesa la devolucion — no
 * necesariamente el cajero de la venta original), mismo criterio que
 * `VoidSaleDto`/`CorrectSaleDto`.
 *
 * `cashSessionId` (ver analisis del Bloque 4): la sesion que EMITE el
 * reembolso — no necesariamente la sesion de la venta original (una
 * devolucion suele ocurrir dias despues, en otra sesion). El cliente la
 * declara explicitamente (mismo criterio que `CreateSaleDto.cashSessionId`
 * en `sales/types.ts`, que tampoco se auto-resuelve), tipicamente la sesion
 * actualmente abierta.
 */
export interface CreateSaleReturnDto {
  saleId: string;
  cashSessionId: string;
  reason: string;
  refundMethod: PaymentMethod;
  performedByUserId: string;
  items: CreateSaleReturnItemDto[];
}

/** Resumen de la sucursal asociada a una devolucion. */
export interface SaleReturnSucursalSummary {
  id: string;
  name: string;
}

/** Resumen del usuario que proceso la devolucion. */
export interface SaleReturnUserSummary {
  id: string;
  fullName: string;
}

/** Forma de una linea de devolucion tal como la expondria el modulo.
 * `unitPrice`/`lineTotal` son SNAPSHOT calculados al momento de la
 * devolucion, mismo criterio que `SaleItemResponse`.
 *
 * `restock` (Bloque 4.4, "Destino del producto"): NO es una columna de
 * `SaleReturnItem` (esa decision nunca se persistio, ver Bloque 4.2) —
 * `returns.service.ts` la reconstruye en el momento de leer, verificando
 * si existe un `InventoryMovement` de esa devolucion para ese producto
 * (`findRestockedProductIdsByReturnIds`). Pura lectura para mostrar el
 * historial; no cambia como se crea una devolucion. */
export interface SaleReturnItemResponse {
  id: string;
  saleItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  restock: boolean;
}

/**
 * Forma de una devolucion tal como la expondria el modulo hacia el resto de
 * la app. `totalAmount` es la suma de los `lineTotal` de sus `items`,
 * calculada por el servicio — nunca se recibe del cliente.
 */
export interface SaleReturnResponse {
  id: string;
  saleId: string;
  sucursalId: string;
  cashSessionId: string;
  userId: string;
  reason: string;
  refundMethod: PaymentMethod;
  totalAmount: number;
  sucursal: SaleReturnSucursalSummary;
  user: SaleReturnUserSummary;
  items: SaleReturnItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

/** Filtros de busqueda/listado disponibles para devoluciones (para un
 * futuro `GET /returns`, todavia sin implementar). */
export interface ListSaleReturnsFilters {
  saleId?: string;
  sucursalId?: string;
  cashSessionId?: string;
  userId?: string;
}

/** Parametros combinados para listar devoluciones: filtros + paginacion. */
export interface ListSaleReturnsQuery extends PaginationParams {
  filters?: ListSaleReturnsFilters;
}

/** Resultado de una operacion de listado paginado de devoluciones. */
export interface ListSaleReturnsResult {
  items: SaleReturnResponse[];
  total: number;
}
