/**
 * modules/taxes/taxes.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de impuestos.
 * Define unicamente las formas de datos que consumen `taxes.service.ts`,
 * `taxes.repository.ts` y `taxes.controller.ts`; no contiene logica de
 * negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `taxes.service.ts`, `taxes.repository.ts` y
 * `taxes.validation.ts`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';
import type { LookupParams } from '@/shared/utils/lookup';

/** Forma de un impuesto tal como lo expone el modulo hacia el resto de la app. */
export interface TaxResponse {
  id: string;
  code: string;
  name: string;
  rate: number;
  isDefault: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un impuesto. */
export interface CreateTaxDto {
  code: string;
  name: string;
  rate: number;
  isDefault?: boolean;
  active?: boolean;
}

/** Datos permitidos para actualizar un impuesto existente. Todos opcionales. */
export interface UpdateTaxDto {
  code?: string;
  name?: string;
  rate?: number;
  isDefault?: boolean;
}

/** Filtros de busqueda/listado disponibles para impuestos. */
export interface ListTaxesFilters {
  active?: boolean;
  isDefault?: boolean;
  search?: string;
}

/** Parametros combinados para listar impuestos: filtros + paginacion. */
export interface ListTaxesQuery extends PaginationParams {
  filters?: ListTaxesFilters;
}

/** Filtros del patron de lookup (busqueda acotada para selectores) —
 * deliberadamente mas chico que `ListTaxesFilters`, ver
 * `shared/utils/lookup.ts`. */
export interface LookupTaxesFilters {
  search?: string;
  active?: boolean;
}

/** Parametros combinados para el lookup de impuestos: filtros + `take`. */
export interface LookupTaxesQuery extends LookupParams {
  filters?: LookupTaxesFilters;
}

/** Payload para cambiar el estado (activo/inactivo) de un impuesto. */
export interface ChangeTaxStatusDto {
  active: boolean;
}

/** Resultado de una operacion de listado paginado de impuestos. */
export interface ListTaxesResult {
  items: TaxResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico impuesto. */
export interface TaxResult {
  tax: TaxResponse;
}
