/**
 * modules/suppliers/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de proveedores.
 * Define unicamente las formas de datos que consumen `suppliers.service.ts`,
 * `suppliers.repository.ts` y `suppliers.controller.ts`; no contiene logica
 * de negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `suppliers.service.ts`, `suppliers.repository.ts` y
 * `suppliers.validation.ts`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';
import type { LookupParams } from '@/shared/utils/lookup';

/** Forma de un proveedor tal como lo expone el modulo hacia el resto de la app. */
export interface SupplierResponse {
  id: string;
  name: string;
  legalId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un proveedor. */
export interface CreateSupplierDto {
  name: string;
  legalId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active?: boolean;
}

/** Datos permitidos para actualizar un proveedor existente. Todos opcionales. */
export interface UpdateSupplierDto {
  name?: string;
  legalId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/** Filtros de busqueda/listado disponibles para proveedores. */
export interface ListSuppliersFilters {
  active?: boolean;
  search?: string;
}

/** Parametros combinados para listar proveedores: filtros + paginacion. */
export interface ListSuppliersQuery extends PaginationParams {
  filters?: ListSuppliersFilters;
}

/** Filtros del patron de lookup (busqueda acotada para selectores) —
 * deliberadamente mas chico que `ListSuppliersFilters`, ver
 * `shared/utils/lookup.ts`. */
export interface LookupSuppliersFilters {
  search?: string;
  active?: boolean;
}

/** Parametros combinados para el lookup de proveedores: filtros + `take`. */
export interface LookupSuppliersQuery extends LookupParams {
  filters?: LookupSuppliersFilters;
}

/** Payload para cambiar el estado (activo/inactivo) de un proveedor. */
export interface ChangeSupplierStatusDto {
  active: boolean;
}

/** Resultado de una operacion de listado paginado de proveedores. */
export interface ListSuppliersResult {
  items: SupplierResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico proveedor. */
export interface SupplierResult {
  supplier: SupplierResponse;
}
