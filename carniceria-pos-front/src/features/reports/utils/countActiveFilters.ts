/**
 * features/reports/utils/countActiveFilters.ts
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado, "indicador de filtros activos"): cuenta
 * cuántas claves de un objeto de filtros tienen un valor real (no
 * `undefined`, no cadena vacía) — mismo criterio que cada `*Filters.tsx`
 * ya usaba a mano para su `hasActiveFilters` (`Boolean(filters.x || ...)`),
 * generalizado para no repetir la misma cuenta en los 8 archivos. Sin
 * lógica de dominio: no sabe qué significa cada filtro, solo cuántos
 * están puestos.
 */
export function countActiveFilters<T extends object>(filters: T): number {
  return Object.values(filters as Record<string, unknown>).filter(
    (value) => value !== undefined && value !== '',
  ).length
}
