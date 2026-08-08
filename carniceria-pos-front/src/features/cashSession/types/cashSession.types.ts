/**
 * features/cashSession/types/cashSession.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo CashSession. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/cash/types.ts` y `modules/cash/validation.ts`
 * (Zod) del backend, seccion `CashSession` unicamente (el backend agrupa
 * `CashSession` y `CashMovement` en el mismo modulo `cash`; este archivo
 * solo cubre `CashSession`, ver alcance mas abajo).
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`openedAt`,
 * `closedAt`, `createdAt`, `updatedAt`) se tipan aqui como `string`,
 * porque asi es como viajan realmente por HTTP (JSON no tiene tipo
 * `Date`; se serializan a ISO string). Mismo criterio ya usado en
 * `user.types.ts`, `product.types.ts`, `sale.types.ts`,
 * `purchase.types.ts`, `inventory.types.ts` y `cashRegister.types.ts`.
 *
 * Alcance de este archivo (Sprint de Integracion Caja + POS, ampliado
 * para el Bloque 1 de cierre): cubre APERTURA y CIERRE de sesion de
 * caja. No incluye `UpdateCashSessionDto` — editar una sesion (notas)
 * no forma parte de este alcance.
 *
 * Ampliado (A-17): se agrega el DTO de creacion de `CashMovement`
 * (registro de ingresos/egresos de efectivo desde el POS). El listado
 * (`ListCashMovementsFilters`, `CashMovementResponse` con paginacion)
 * queda fuera de alcance de este bloque: el backend restringe
 * `GET /cash/movements` a ADMIN/MANAGER, y esa pantalla administrativa
 * se implementara en una fase posterior.
 *
 * `sucursalId` y `openedByUserId` NO forman parte de `CreateCashSessionDto`:
 * el backend resuelve ambos desde `req.user` (JWT), no desde el body —
 * mismo criterio ya aplicado en `CreateSaleDto` (features/sales/types)
 * tras el Sprint de Seguridad. Confirmado contra
 * `modules/cash/validation.ts`: `OpenCashSessionSchema` solo valida
 * `cashRegisterId`, `openingAmount` y `notes`.
 */

/** Estado de la sesion de caja (enum `CashSessionStatus` de schema.prisma). */
export type CashSessionStatus = 'OPEN' | 'CLOSED'

/**
 * Sesion de caja tal como la expone el backend (`CashSessionResponse`).
 * `closedByUserId`, `closedAt`, `closingAmount`, `expectedAmount` y
 * `difference` son `null` mientras la sesion sigue abierta; se completan
 * al cerrarla (fuera de alcance de este sprint, pero se reflejan aqui
 * porque son parte de la respuesta real que devuelve el backend).
 */
export interface CashSession {
  id: string
  sucursalId: string
  cashRegisterId: string
  status: CashSessionStatus
  openedByUserId: string
  openedAt: string
  openingAmount: number
  closedByUserId: string | null
  closedAt: string | null
  closingAmount: number | null
  expectedAmount: number | null
  difference: number | null
  notes: string | null
  sucursal: {
    id: string
    code: string
    name: string
  }
  openedBy: {
    id: string
    fullName: string
  }
  closedBy: {
    id: string
    fullName: string
  } | null
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para abrir una sesion de caja.
 * Coincide exactamente con `OpenCashSessionSchema` (Zod) del backend:
 * `notes` es `.nullish()`. `sucursalId` y `openedByUserId` NO se envian
 * (ver nota de alcance arriba) — el backend los resuelve desde `req.user`.
 */
export interface OpenCashSessionDto {
  cashRegisterId: string
  openingAmount: number
  notes?: string | null
}

/**
 * Datos requeridos para cerrar una sesion de caja.
 * Coincide exactamente con `CloseCashSessionSchema` (Zod) del backend:
 * `notes` es `.nullish()`. `closedByUserId` NO se envia — el backend lo
 * resuelve desde `req.user` (hallazgo 3.2 de la auditoria, ya
 * corregido), mismo criterio que `openedByUserId` en `OpenCashSessionDto`.
 * `expectedAmount`/`difference` tampoco se envian: los calcula el
 * backend a partir de `closingAmount` y los movimientos de la sesion.
 */
export interface CloseCashSessionDto {
  closingAmount: number
  notes?: string | null
}

/**
 * Filtros de listado de sesiones de caja.
 * Coincide exactamente con `ListCashSessionsFilters` del backend: mismos
 * nombres y mismos tipos.
 */
export interface CashSessionFilters {
  sucursalId?: string
  cashRegisterId?: string
  status?: CashSessionStatus
}

/**
 * Respuesta real de GET /cash/sessions.
 * El controlador (`cash/controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedCashSessionsResponse {
  success: true
  data: CashSession[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/** Tipo de movimiento de caja (enum `CashMovementType` de schema.prisma).
 * QA.5 (Caja): faltaba `REFUND` (Bloque 4.1, reembolso en efectivo de una
 * devolución, `returns/service.ts`) — un movimiento real que el backend ya
 * podía devolver, pero que este tipo no contemplaba. Solo se agrega para
 * lectura/visualización (`CashMovementsTable.tsx`,
 * `cashSessionInsights.ts`): `CreateCashMovementSchema` (creación manual)
 * sigue aceptando únicamente `CASH_IN`/`CASH_OUT` — un `REFUND` nunca se
 * crea a mano, solo lo genera el flujo de Devoluciones.
 *
 * Version 1.0.3, Bloque 3: mismo criterio para `CHANGE` (vuelto en
 * efectivo, Bloque 1) — únicamente de lectura/visualización, nunca
 * ofrecido en la creación manual. `cashSessionInsights.ts` NO clasifica
 * `CHANGE` como ingreso ni como egreso a propósito (mismo criterio que ya
 * usa `cash/service.ts::computeExpectedAmount` en el backend: el vuelto ya
 * está excluido del efectivo esperado) — este bloque es exclusivamente de
 * presentación, no toca ese cálculo. */
export type CashMovementType = 'CASH_IN' | 'CASH_OUT' | 'REFUND' | 'CHANGE'

/**
 * Datos requeridos para registrar un movimiento de caja.
 * Coincide exactamente con `CreateCashMovementSchema` (Zod) del backend:
 * `cashSessionId`, `type`, `amount` (positivo) y `reason` (mínimo 3
 * caracteres) son obligatorios. `sucursalId` y `userId` NO se envían —
 * el backend los resuelve desde `req.user`, mismo criterio que
 * `OpenCashSessionDto`/`CloseCashSessionDto`.
 */
export interface CreateCashMovementDto {
  cashSessionId: string
  type: CashMovementType
  amount: number
  reason: string
}

/**
 * Rediseño de Caja — pestaña "Movimientos": `CashMovement` tal como lo
 * expone el backend (`CashMovementResponse`, `modules/cash/types.ts`).
 * Antes solo existía una forma mínima local en `cashMovements.api.ts` (la
 * respuesta de CREAR un movimiento); esta es la forma completa, con las
 * relaciones ya resueltas, necesaria para LISTAR — mismo criterio que
 * `Purchase`/`Sale` (sucursal/usuario como resumen embebido).
 */
export interface CashMovement {
  id: string
  sucursalId: string
  cashSessionId: string
  userId: string
  type: CashMovementType
  amount: number
  reason: string
  sucursal: {
    id: string
    code: string
    name: string
  }
  user: {
    id: string
    fullName: string
  }
  createdAt: string
  updatedAt: string
}

/**
 * Filtros de listado de movimientos de caja.
 * Coincide exactamente con `ListCashMovementsFilters` del backend: mismos
 * nombres y mismos tipos.
 */
export interface ListCashMovementsFilters {
  sucursalId?: string
  cashSessionId?: string
  userId?: string
  type?: CashMovementType
  page?: number
  limit?: number
}

/** Respuesta real de GET /cash/movements — mismo sobre (`ApiSuccess<T>` +
 * `PaginationMeta`) que `PaginatedCashSessionsResponse`. */
export interface PaginatedCashMovementsResponse {
  success: true
  data: CashMovement[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}