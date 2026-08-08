/**
 * features/cashRegisters/types/cashRegister.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo CashRegisters. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/cashRegister/cashRegister.types.ts` y
 * `modules/cashRegister/cashRegister.validation.ts` (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como viajan
 * realmente por HTTP (JSON no tiene tipo `Date`; se serializan a ISO
 * string). Mismo criterio ya usado en `user.types.ts`, `product.types.ts`,
 * `category.types.ts`, `sale.types.ts`, `purchase.types.ts` e
 * `inventory.types.ts`.
 *
 * Alcance de este archivo (Sprint de Integracion Caja + POS): solo el
 * listado de cajas registradoras, que es lo unico que el flujo de
 * apertura de sesion necesita (elegir con cual caja operar). No se
 * incluyen `CreateCashRegisterDto`, `UpdateCashRegisterDto` ni
 * `ChangeCashRegisterStatusDto` — el backend los tiene, pero no se
 * consumen todavia (no hay pantalla de administracion de cajas
 * registradoras en este sprint).
 */

/**
 * Caja registradora tal como la expone el backend
 * (`CashRegisterResponse`).
 */
export interface CashRegister {
  id: string
  sucursalId: string
  name: string
  sucursal: {
    id: string
    code: string
    name: string
  }
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Filtros de listado de cajas registradoras.
 * Coincide exactamente con `ListCashRegistersFilters` del backend: mismos
 * nombres y mismos tipos.
 */
export interface CashRegisterFilters {
  sucursalId?: string
  active?: boolean
  search?: string
}

/**
 * Respuesta real de GET /cash-registers.
 * El controlador (`cashRegister.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedCashRegistersResponse {
  success: true
  data: CashRegister[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
