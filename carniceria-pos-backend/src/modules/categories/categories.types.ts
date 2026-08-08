/**
 * modules/categories/categories.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de categorias.
 * Define unicamente las formas de datos que consumen `categories.service.ts`,
 * `categories.repository.ts` y `categories.controller.ts`; no contiene logica
 * de negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `categories.service.ts`, `categories.repository.ts` y
 * `categories.validation.ts`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';
import type { LookupParams } from '@/shared/utils/lookup';

/** Resumen de una categoria, usado como referencia dentro de otra categoria (padre/hijas). */
export interface CategorySummary {
  id: string;
  name: string;
  color: string | null;
}

/** Forma de una categoria tal como la expone el modulo hacia el resto de la app. */
export interface CategoryResponse {
  id: string;
  name: string;
  description: string | null;
  /** Color personalizado (hex, ej. "#3B82F6") — `null` si la categoria no
   * tiene uno propio. Compatibilidad con categorias existentes: el
   * frontend sigue resolviendo un color deterministico por `id`
   * (`getCategoryColor`) cuando este campo es `null`. */
  color: string | null;
  parentId: string | null;
  parent: CategorySummary | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear una categoria. */
export interface CreateCategoryDto {
  name: string;
  description?: string | null;
  color?: string | null;
  parentId?: string | null;
  active?: boolean;
}

/** Datos permitidos para actualizar una categoria existente. Todos opcionales. */
export interface UpdateCategoryDto {
  name?: string;
  description?: string | null;
  color?: string | null;
  parentId?: string | null;
}

/** Filtros de busqueda/listado disponibles para categorias. */
export interface ListCategoriesFilters {
  parentId?: string | null;
  active?: boolean;
  search?: string;
}

/** Parametros combinados para listar categorias: filtros + paginacion. */
export interface ListCategoriesQuery extends PaginationParams {
  filters?: ListCategoriesFilters;
}

/** Filtros del patron de lookup (busqueda acotada para selectores) —
 * deliberadamente mas chico que `ListCategoriesFilters`, ver
 * `shared/utils/lookup.ts`. */
export interface LookupCategoriesFilters {
  search?: string;
  active?: boolean;
}

/** Parametros combinados para el lookup de categorias: filtros + `take`. */
export interface LookupCategoriesQuery extends LookupParams {
  filters?: LookupCategoriesFilters;
}

/**
 * Arquitectura de selectores, Bloque 2 (frontend): forma especifica del
 * lookup de categorias — DELIBERADAMENTE mas rica que el `LookupItem`
 * generico (`shared/utils/lookup.ts`, `{id,label}`) porque
 * `CategorySearchDialog.tsx` necesita mostrar la categoria padre y la
 * descripcion por fila sin perder esa experiencia visual. Sigue sin ser
 * el recurso completo (`CategoryResponse`): sin `parentId`, sin
 * `active`/timestamps, sin el objeto `parent` completo (solo su
 * `name`) — solo lo que esa fila realmente pinta.
 */
export interface CategoryLookupItem {
  id: string;
  label: string;
  parentName: string | null;
  description: string | null;
  color: string | null;
}

/** Payload para cambiar el estado (activo/inactivo) de una categoria. */
export interface ChangeCategoryStatusDto {
  active: boolean;
}

/** Resultado de una operacion de listado paginado de categorias. */
export interface ListCategoriesResult {
  items: CategoryResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven una unica categoria. */
export interface CategoryResult {
  category: CategoryResponse;
}
