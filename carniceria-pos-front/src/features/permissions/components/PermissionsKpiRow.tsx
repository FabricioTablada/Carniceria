import { KeyRound, LayoutGrid } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { getPermissionModuleKey } from '@/utils/permissionModule'
import type { Permission } from '../types/permission.types'

interface PermissionsKpiRowProps {
  permissions: Permission[]
}

/**
 * features/permissions/components/PermissionsKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.29B.1 (paridad visual con Productos): pasa de 2 `KpiCard`
 * independientes (`size="compact"`, cada una con su propio borde/sombra)
 * a una sola franja `bare`/`size="xs"`/`divide-x` — mismo patrón que
 * `ProductsKpiRow.tsx`, ahora como la primera banda del Canvas Workspace
 * de `PermissionsPage.tsx` en vez de un bloque suelto encima.
 *
 * A diferencia de `ProductsKpiRow.tsx`, ninguna celda es clicable
 * (decisión explícita del bloque: "los KPIs deben seguir siendo
 * únicamente indicadores") — sin `<button>`, sin `onClick`, sin estado de
 * filtro asociado. Mismas 2 tarjetas de siempre ("Total de permisos"/
 * "Total de módulos"), mismo cálculo, sin agregar ninguna tercera por
 * pura simetría con la grilla de 4 de Productos.
 */
export function PermissionsKpiRow({ permissions }: PermissionsKpiRowProps) {
  const totalPermissions = permissions.length
  const totalModules = new Set(permissions.map((permission) => getPermissionModuleKey(permission.code))).size

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      <KpiCard bare label="Total de permisos" value={totalPermissions} icon={KeyRound} size="xs" />
      <KpiCard bare label="Total de módulos" value={totalModules} icon={LayoutGrid} size="xs" />
    </div>
  )
}
