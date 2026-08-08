/**
 * modules/cashRegister/cashRegister.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de cajas registradoras.
 * Define unicamente las formas de datos que consumen
 * `cashRegister.service.ts`, `cashRegister.repository.ts` y
 * `cashRegister.controller.ts`; no contiene logica de negocio, consultas
 * Prisma ni validaciones (eso vive en sus respectivos archivos:
 * `cashRegister.service.ts`, `cashRegister.repository.ts` y
 * `cashRegister.validation.ts`).
 *
 * NOTA: el modelo `CashRegister` de `schema.prisma` no tiene ninguna
 * restriccion `@@unique`, por lo que este modulo no valida duplicados (a
 * diferencia de Categories, Products y Taxes).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Resumen de la sucursal asociada a una caja registradora. */
export interface CashRegisterSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Forma de una caja registradora tal como la expone el modulo hacia el
 * resto de la app. */
export interface CashRegisterResponse {
  id: string;
  sucursalId: string;
  name: string;
  sucursal: CashRegisterSucursalSummary;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear una caja registradora. */
export interface CreateCashRegisterDto {
  sucursalId: string;
  name: string;
  active?: boolean;
}

/** Datos permitidos para actualizar una caja registradora existente. Todos
 * opcionales. */
export interface UpdateCashRegisterDto {
  sucursalId?: string;
  name?: string;
}

/** Filtros de busqueda/listado disponibles para cajas registradoras. */
export interface ListCashRegistersFilters {
  sucursalId?: string;
  active?: boolean;
  search?: string;
}

/** Parametros combinados para listar cajas registradoras: filtros +
 * paginacion. */
export interface ListCashRegistersQuery extends PaginationParams {
  filters?: ListCashRegistersFilters;
}

/** Payload para cambiar el estado (activo/inactivo) de una caja
 * registradora. */
export interface ChangeCashRegisterStatusDto {
  active: boolean;
}

/** Resultado de una operacion de listado paginado de cajas registradoras. */
export interface ListCashRegistersResult {
  items: CashRegisterResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven una unica caja registradora. */
export interface CashRegisterResult {
  cashRegister: CashRegisterResponse;
}
