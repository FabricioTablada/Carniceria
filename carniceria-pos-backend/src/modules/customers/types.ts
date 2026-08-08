/**
 * modules/customers/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de clientes.
 * Define unicamente las formas de datos que consumen `customers.service.ts`,
 * `customers.repository.ts` y `customers.controller.ts`; no contiene logica
 * de negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `customers.service.ts`, `customers.repository.ts` y
 * `customers.validation.ts`).
 *
 * Bloque 8.2: mismo patron exacto que `modules/suppliers/types.ts` — catalogo
 * UNICO para toda la empresa (aclaracion de producto: el ERP opera con una
 * unica sucursal), sin `sucursalId` en ningun lado.
 */
import type { PaginationParams } from '@/shared/utils/pagination';
import type { LookupParams } from '@/shared/utils/lookup';

/** Tipo de identificacion soportado (enum `CustomerIdentificationType` de
 * `schema.prisma`) — mismo catalogo real de Alegra Costa Rica confirmado en
 * el Bloque 7.13. */
export type CustomerIdentificationType = 'CF' | 'CJ' | 'DIMEX' | 'NITE' | 'PE';

/** Forma de un cliente tal como lo expone el modulo hacia el resto de la app. */
export interface CustomerResponse {
  id: string;
  name: string;
  identificationType: CustomerIdentificationType;
  identificationNumber: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un cliente. */
export interface CreateCustomerDto {
  name: string;
  identificationType: CustomerIdentificationType;
  identificationNumber: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  active?: boolean;
}

/** Datos permitidos para actualizar un cliente existente. Todos opcionales. */
export interface UpdateCustomerDto {
  name?: string;
  identificationType?: CustomerIdentificationType;
  identificationNumber?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

/** Filtros de busqueda/listado disponibles para clientes. */
export interface ListCustomersFilters {
  active?: boolean;
  search?: string;
}

/** Parametros combinados para listar clientes: filtros + paginacion. */
export interface ListCustomersQuery extends PaginationParams {
  filters?: ListCustomersFilters;
}

/** Filtros del patron de lookup (busqueda acotada para selectores) —
 * deliberadamente mas chico que `ListCustomersFilters`, ver
 * `shared/utils/lookup.ts`. Sin consumidor todavia (la seleccion de
 * clientes en Ventas es Bloque 8.3) — se deja lista la infraestructura de
 * busqueda pedida explicitamente en el Bloque 8.2, sin construir ningun
 * picker de UI que todavia no tiene para donde apuntar. */
export interface LookupCustomersFilters {
  search?: string;
  active?: boolean;
}

/** Parametros combinados para el lookup de clientes: filtros + `take`. */
export interface LookupCustomersQuery extends LookupParams {
  filters?: LookupCustomersFilters;
}

/** Payload para cambiar el estado (activo/inactivo) de un cliente. */
export interface ChangeCustomerStatusDto {
  active: boolean;
}

/** Resultado de una operacion de listado paginado de clientes. */
export interface ListCustomersResult {
  items: CustomerResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico cliente. */
export interface CustomerResult {
  customer: CustomerResponse;
}
