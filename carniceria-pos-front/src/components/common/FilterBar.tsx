import type { ReactNode } from 'react'

/**
 * components/common/FilterBar.tsx
 * -----------------------------------------------------------------------------
 * Unifica el contenedor de las barras de filtros, confirmado identico byte
 * a byte en las 10 implementaciones reales del proyecto
 * (`ProductFilters`, `PurchaseFilters`, `UserFilters`, `SaleFilters`,
 * `InventoryFilters`, `RoleFilters`, etc.): `flex flex-wrap items-end
 * gap-3`.
 *
 * Presentacion pura, y deliberadamente MINIMA: solo extrae el contenedor,
 * no el contenido de los campos. Cada campo individual (`<div
 * className="flex flex-col gap-1.5"><Label/><Input o Select/></div>`)
 * varia demasiado entre modulos — texto, selects con opciones dinamicas
 * resueltas por lookup, selects de estado con valores fijos — como para
 * generalizarlo sin inventar un "esquema de campos" que no existe en
 * ningun lado del codigo real hoy. Ese contenido sigue siendo
 * responsabilidad de cada `XxxFilters.tsx`, pasado como `children`, mismo
 * criterio ya aplicado en `PageHeader.tsx` con la prop `action`.
 *
 * Vive en `components/common/`, junto a `Can.tsx`, `Badge.tsx`,
 * `ErrorAlert.tsx`, `Skeleton.tsx`, `PageHeader.tsx` y `KpiCard.tsx` — no
 * se crea ninguna carpeta nueva.
 */

interface FilterBarProps {
  children: ReactNode
}

export function FilterBar({ children }: FilterBarProps) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>
}