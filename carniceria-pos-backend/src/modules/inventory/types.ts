/**
 * modules/inventory/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de inventario.
 * Define unicamente las formas de datos que consumen `inventory.service.ts`,
 * `inventory.repository.ts` y `inventory.controller.ts`; no contiene logica
 * de negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `inventory.service.ts`, `inventory.repository.ts` y
 * `inventory.validation.ts`).
 *
 * NOTA: el modelo `Inventory` de `schema.prisma` no tiene campo `active`, por
 * lo que este modulo no expone cambio de estado (a diferencia de Categories,
 * Products, Taxes y Suppliers).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Unidad de medida del producto asociado (enum `UnitOfMeasure` de `schema.prisma`). */
export type UnitOfMeasure = 'KILOGRAM' | 'UNIT';

/** Resumen de la sucursal asociada a una existencia de inventario. */
export interface InventorySucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Resumen del producto asociado a una existencia de inventario. */
export interface InventoryProductSummary {
  id: string;
  name: string;
  sku: string | null;
  unitOfMeasure: UnitOfMeasure;
}

/** Forma de una existencia de inventario tal como la expone el modulo. */
export interface InventoryResponse {
  id: string;
  sucursalId: string;
  productId: string;
  quantity: number;
  reorderPoint: number | null;
  sucursal: InventorySucursalSummary;
  product: InventoryProductSummary;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear una existencia de inventario. */
export interface CreateInventoryDto {
  sucursalId: string;
  productId: string;
  quantity?: number;
  reorderPoint?: number | null;
}

/** Datos permitidos para actualizar una existencia de inventario. Todos opcionales. */
export interface UpdateInventoryDto {
  sucursalId?: string;
  productId?: string;
  quantity?: number;
  reorderPoint?: number | null;
}

/** Filtros de busqueda/listado disponibles para inventario. */
export interface ListInventoryFilters {
  sucursalId?: string;
  productId?: string;
  /** Bloque 7.29A: busqueda por nombre/SKU/codigo de barras del producto
   * asociado a la existencia -- se filtra sobre la relacion `product`,
   * ver `buildWhere` en `repository.ts`. */
  search?: string;
}

/** Parametros combinados para listar inventario: filtros + paginacion. */
export interface ListInventoryQuery extends PaginationParams {
  filters?: ListInventoryFilters;
}

/** Resultado de una operacion de listado paginado de inventario. */
export interface ListInventoryResult {
  items: InventoryResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven una unica existencia de inventario. */
export interface InventoryResult {
  inventory: InventoryResponse;
}
