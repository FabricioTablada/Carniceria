import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { PERMISSIONS } from '@/constants/permissions'
import { groupPermissionsByModule, matchesPermissionSearch } from '@/utils/permissionModule'
import { PERMISSIONS_CATALOG_LIMIT } from '../constants/permission.constants'
import { usePermissions } from '../hooks/usePermissions'
import { PermissionFilters } from '../components/PermissionFilters'
import { PermissionTable } from '../components/PermissionTable'
import { PermissionDrawer } from '../components/PermissionDrawer'
import { PermissionsKpiRow } from '../components/PermissionsKpiRow'
import type {
  Permission,
  PermissionFilters as PermissionFiltersValue,
} from '../types/permission.types'

/**
 * features/permissions/pages/PermissionsPage.tsx
 * -----------------------------------------------------------------------------
 * Bloque Permisos (rediseño, aprobado): el listado pasa de una tabla plana
 * paginada a una vista agrupada por módulo (`PermissionTable.tsx`) — eso
 * exige tener el catálogo COMPLETO disponible en el cliente (un módulo no
 * puede quedar dividido entre la página 1 y la página 2), así que esta
 * pantalla deja de usar `usePagination`/`Pagination` y pide el catálogo
 * entero de una sola vez con `usePermissions({ limit: PERMISSIONS_CATALOG_LIMIT })`
 * — misma constante (`constants/permission.constants.ts`) que usa
 * `EditRolePage.tsx` por el mismo motivo.
 *
 * La búsqueda (código, descripción o módulo derivado) se resuelve
 * enteramente en el cliente con `matchesPermissionSearch` — el filtro
 * "módulo derivado" no existe como parámetro del backend (es una
 * convención de nomenclatura, no un campo real), así que no tiene sentido
 * mezclarlo con el `search` del backend: se pide el catálogo sin filtrar y
 * se filtra acá.
 *
 * Los KPIs (`PermissionsKpiRow`) reciben el catálogo SIN filtrar
 * (`permissionsResponse`), no el resultado de la búsqueda — mismo criterio
 * "autónomo" que `ProductsKpiRow.tsx`.
 *
 * Bloque 7.29B.1 (paridad visual con Productos, wireframe aprobado):
 * - Envuelve KPIs + Toolbar (búsqueda + "Expandir todo") + lista en un
 *   único Canvas Workspace (`rounded-2xl border border-border bg-card
 *   shadow-sm`, bandas separadas por `border-b`), mismo patrón que
 *   `ProductsPage.tsx`/`RolesPage.tsx`/`InventoryPage.tsx` — antes eran 3
 *   bloques sueltos.
 * - Agrega `breadcrumb` al `PageHeader` (faltaba, a diferencia de
 *   Productos/Roles).
 * - "Expandir todo/Colapsar todo" se agrega al slot `actions` del
 *   `Toolbar`, junto al buscador — los KPIs NO se tocan como disparador
 *   de esta acción (quedan como indicadores puros, sin `onClick`).
 * - `expandedModuleKeys`: estado de expansión de los grupos, antes no
 *   controlado (cada `<details>` manejaba su propio estado nativo, todos
 *   arrancaban colapsados). Ahora vive acá para que el botón "Expandir
 *   todo" y la búsqueda puedan afectarlo. Mientras hay una búsqueda
 *   activa, los módulos visibles (los que ya tienen al menos una
 *   coincidencia — `filteredPermissions` ya los filtra antes de agrupar,
 *   sin cambios en esa lógica) se auto-expanden, para no exigir un click
 *   extra por cada uno; al borrar la búsqueda vuelve al comportamiento de
 *   siempre (todo colapsado). El usuario sigue pudiendo expandir/colapsar
 *   manualmente en cualquier momento.
 */
export function PermissionsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<PermissionFiltersValue>({})
  const [drawerPermission, setDrawerPermission] = useState<Permission | null>(null)
  const [expandedModuleKeys, setExpandedModuleKeys] = useState<Set<string>>(new Set())
  // "Ajustar estado durante el render" (patrón oficial de React para
  // reaccionar a un cambio de prop/estado sin `useEffect`, ver
  // react.dev/learn/you-might-not-need-an-effect) — evita el
  // `useEffect`+`setState` incondicional que el lint de React 19
  // (`react-hooks/set-state-in-effect`) rechaza para este caso.
  const [prevSearch, setPrevSearch] = useState(filters.search)

  const { data, isLoading, isError, error } = usePermissions({ limit: PERMISSIONS_CATALOG_LIMIT })
  const permissions = useMemo(() => data?.data ?? [], [data])

  const filteredPermissions = useMemo(
    () => permissions.filter((permission) => matchesPermissionSearch(permission, filters.search ?? '')),
    [permissions, filters.search],
  )

  const moduleKeys = useMemo(
    () => groupPermissionsByModule(filteredPermissions).map((group) => group.moduleKey),
    [filteredPermissions],
  )

  // Auto-expande únicamente los módulos con coincidencias mientras hay una
  // búsqueda activa; al borrarla, vuelve a colapsar todo (comportamiento
  // de siempre). No afecta que el usuario siga expandiendo/colapsando a
  // mano después de que esto corra.
  if (filters.search !== prevSearch) {
    setPrevSearch(filters.search)
    setExpandedModuleKeys(filters.search ? new Set(moduleKeys) : new Set())
  }

  const allExpanded = moduleKeys.length > 0 && moduleKeys.every((key) => expandedModuleKeys.has(key))

  const handleToggleAll = () => {
    setExpandedModuleKeys(allExpanded ? new Set() : new Set(moduleKeys))
  }

  const handleToggleModule = (moduleKey: string) => {
    setExpandedModuleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(moduleKey)) {
        next.delete(moduleKey)
      } else {
        next.add(moduleKey)
      }
      return next
    })
  }

  const handleCreatePermission = () => {
    navigate('/permissions/new')
  }

  const handleEdit = (permission: Permission) => {
    navigate(`/permissions/${permission.id}/edit`)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Permisos' }]}
        title="Permisos"
        description="Administra el catálogo de permisos del sistema."
        action={
          <Can permission={PERMISSIONS.ROLES_MANAGE}>
            <Button
              type="button"
              onClick={handleCreatePermission}
              className="h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              <Plus className="size-4" />
              Nuevo Permiso
            </Button>
          </Can>
        }
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <PermissionsKpiRow permissions={permissions} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={<PermissionFilters filters={filters} onFiltersChange={setFilters} />}
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={handleToggleAll}
                disabled={moduleKeys.length === 0}
                className="h-10 gap-2 rounded-xl"
              >
                <ChevronsUpDown className="size-4" />
                {allExpanded ? 'Colapsar todo' : 'Expandir todo'}
              </Button>
            }
          />
        </div>

        {isLoading && (
          <div className="p-4">
            <LoadingState message="Cargando permisos..." />
          </div>
        )}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los permisos.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <PermissionTable
            permissions={filteredPermissions}
            hasSearch={Boolean(filters.search)}
            onClearSearch={() => setFilters({})}
            onEdit={handleEdit}
            onRowClick={setDrawerPermission}
            expandedKeys={expandedModuleKeys}
            onToggleKey={handleToggleModule}
          />
        )}
      </div>

      <PermissionDrawer
        permission={drawerPermission}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerPermission(null)
          }
        }}
        onEdit={(permission) => {
          setDrawerPermission(null)
          handleEdit(permission)
        }}
      />
    </div>
  )
}
