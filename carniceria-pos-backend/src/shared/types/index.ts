/**
 * shared/types/index.ts
 * -----------------------------------------------------------------------------
 * Tipos y contratos compartidos entre modulos. Se ampliara conforme crezca el
 * dominio. Los archivos .d.ts de esta carpeta aplican de forma global.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
