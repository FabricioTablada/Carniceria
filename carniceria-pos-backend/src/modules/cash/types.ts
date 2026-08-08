/**
 * modules/cash/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de caja.
 * Define unicamente las formas de datos que consumen `cash.service.ts`,
 * `cash.repository.ts` y `cash.controller.ts`; no contiene logica de
 * negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `cash.service.ts`, `cash.repository.ts` y
 * `cash.validation.ts`).
 *
 * El modulo agrupa DOS agregados de `schema.prisma`: `CashSession` (sesion
 * de caja: apertura y cierre) y `CashMovement` (movimientos manuales de
 * efectivo dentro de una sesion). Se mantienen en el mismo modulo porque asi
 * lo define la arquitectura del proyecto, pero sus tipos se declaran
 * separados y prefijados (`CashSession*` / `CashMovement*`) para que la
 * responsabilidad de cada uno quede clara.
 *
 * NOTA: ninguno de los dos modelos tiene campo `active` ni restriccion
 * `@@unique`, por lo que este modulo no expone cambio de estado por
 * booleano ni validacion de duplicados (a diferencia de Categories,
 * Products, Taxes y Suppliers).
 *
 * REGLA CRITICA: `expectedAmount` y `difference` de `CashSession` NUNCA se
 * reciben del cliente. Siguiendo el mismo patron aprobado en
 * Purchases/Sales, el servicio los calcula a partir de `openingAmount` y
 * los movimientos de caja registrados; el cliente unicamente informa
 * `closingAmount` (el efectivo contado fisicamente al cerrar).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Estado de la sesion de caja (enum `CashSessionStatus` de `schema.prisma`). */
export type CashSessionStatus = 'OPEN' | 'CLOSED';

/** Tipo de movimiento de caja (enum `CashMovementType` de `schema.prisma`). */
export type CashMovementType = 'CASH_IN' | 'CASH_OUT';

/** Resumen de la sucursal asociada a una sesion o a un movimiento de caja. */
export interface CashSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Resumen de un usuario asociado a una sesion o a un movimiento de caja. */
export interface CashUserSummary {
  id: string;
  fullName: string;
}

// ---------------------------------------------------------------------------
// CashSession: sesiones de caja (apertura / cierre)
// ---------------------------------------------------------------------------

/** Forma de una sesion de caja tal como la expone el modulo. `expectedAmount`
 * y `difference` son calculados por el servicio al momento del cierre. */
export interface CashSessionResponse {
  id: string;
  sucursalId: string;
  cashRegisterId: string;
  status: CashSessionStatus;
  openedByUserId: string;
  openedAt: Date;
  openingAmount: number;
  closedByUserId: string | null;
  closedAt: Date | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  notes: string | null;
  sucursal: CashSucursalSummary;
  openedBy: CashUserSummary;
  closedBy: CashUserSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para abrir una sesion de caja. `status`, `openedAt` y
 * los campos de cierre no se reciben: el servicio los establece.
 * `sucursalId` y `openedByUserId` tampoco los envia el cliente: los
 * resuelve `cash.controller.ts` desde `req.user` (JWT, via
 * `authenticate.middleware.ts`) antes de llamar a `cash.service.openSession()`,
 * mismo criterio ya aplicado en `CreateSaleDto` (modules/sales/types.ts).
 * La forma completa se mantiene aqui sin cambios porque el servicio y el
 * repositorio siguen necesitando ambos campos para crear la sesion; lo
 * que cambio es de donde los obtiene el controller, no que datos
 * requiere el servicio. */
export interface OpenCashSessionDto {
  sucursalId: string;
  cashRegisterId: string;
  openedByUserId: string;
  openingAmount: number;
  notes?: string | null;
}

/** Datos permitidos para actualizar una sesion de caja abierta. Los campos
 * de apertura (`sucursalId`, `cashRegisterId`, `openedByUserId`,
 * `openingAmount`) no se editan una vez abierta la sesion. */
export interface UpdateCashSessionDto {
  notes?: string | null;
}

/** Datos requeridos para cerrar una sesion de caja. `closedByUserId` no lo
 * envia el cliente: lo resuelve `cash.controller.ts` desde `req.user`
 * (JWT, via `authenticate.middleware.ts`) antes de llamar a
 * `cash.service.closeSession()` — mismo criterio ya aplicado en
 * `OpenCashSessionDto` (hallazgo 3.2 de la auditoria). `expectedAmount` y
 * `difference` los calcula el servicio a partir de `openingAmount` y los
 * movimientos de caja registrados; el cliente tampoco los envia. */
export interface CloseCashSessionDto {
  closingAmount: number;
  notes?: string | null;
}

/** Filtros de busqueda/listado disponibles para sesiones de caja. */
export interface ListCashSessionsFilters {
  sucursalId?: string;
  cashRegisterId?: string;
  status?: CashSessionStatus;
}

/** Parametros combinados para listar sesiones de caja: filtros + paginacion. */
export interface ListCashSessionsQuery extends PaginationParams {
  filters?: ListCashSessionsFilters;
}

/** Resultado de una operacion de listado paginado de sesiones de caja. */
export interface ListCashSessionsResult {
  items: CashSessionResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven una unica sesion de caja. */
export interface CashSessionResult {
  cashSession: CashSessionResponse;
}

// ---------------------------------------------------------------------------
// CashMovement: movimientos de caja
// ---------------------------------------------------------------------------

/** Forma de un movimiento de caja tal como lo expone el modulo. */
export interface CashMovementResponse {
  id: string;
  sucursalId: string;
  cashSessionId: string;
  userId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  sucursal: CashSucursalSummary;
  user: CashUserSummary;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para registrar un movimiento de caja. */
export interface CreateCashMovementDto {
  sucursalId: string;
  cashSessionId: string;
  userId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
}

/** Filtros de busqueda/listado disponibles para movimientos de caja. */
export interface ListCashMovementsFilters {
  sucursalId?: string;
  cashSessionId?: string;
  userId?: string;
  type?: CashMovementType;
}

/** Parametros combinados para listar movimientos de caja: filtros + paginacion. */
export interface ListCashMovementsQuery extends PaginationParams {
  filters?: ListCashMovementsFilters;
}

/** Resultado de una operacion de listado paginado de movimientos de caja. */
export interface ListCashMovementsResult {
  items: CashMovementResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico movimiento de caja. */
export interface CashMovementResult {
  cashMovement: CashMovementResponse;
}
