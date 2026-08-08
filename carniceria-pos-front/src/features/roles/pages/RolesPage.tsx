import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useRoles } from '../hooks/useRoles'
import { useUpdateRoleStatus } from '../hooks/useUpdateRoleStatus'
import { RoleDrawer } from '../components/RoleDrawer'
import { RoleFilters } from '../components/RoleFilters'
import { RolesKpiRow } from '../components/RolesKpiRow'
import { RolesTable } from '../components/RolesTable'
import { getRoleErrorMessage } from '../utils/roleErrors'
import type { Role, RoleFilters as RoleFiltersValue } from '../types/role.types'

/**
 * features/roles/pages/RolesPage.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Roles (aprobado, "copiar la estructura base de Productos, no
 * reinterpretar el layout"): mismo Canvas Workspace único
 * (`rounded-2xl border bg-card shadow-sm`) que `ProductsPage.tsx` — KPI
 * strip (bare/xs, clicable) + Toolbar (`bare`, con `RoleFilters`) + tabla +
 * paginación como franjas internas separadas por `border-b`/`border-t`, en
 * vez de bloques sueltos apilados con su propio espaciado.
 */
export function RolesPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<RoleFiltersValue>({})
  const [drawerRole, setDrawerRole] = useState<Role | null>(null)

  // Arquitectura de listados, Bloque 4: `usePagination`/`Pagination`
  // agregan paginacion real — antes esta pagina nunca enviaba `page` ni
  // `limit`, quedando fija en la primera pagina (20 registros por defecto
  // del backend).
  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useRoles({ ...filters, page })
  const { mutate: updateRoleStatus } = useUpdateRoleStatus()

  // Cualquier cambio de filtro vuelve a la pagina 1, mismo criterio que
  // ProductsPage.tsx.
  const handleFiltersChange = (nextFilters: RoleFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
  }

  const handleCreateRole = () => {
    navigate('/roles/new')
  }

  const handleEdit = (role: Role) => {
    navigate(`/roles/${role.id}/edit`)
  }

  const handleToggleStatus = (role: Role) => {
    updateRoleStatus(
      { id: role.id, dto: { active: !role.active } },
      { onError: (error) => toast.error(getRoleErrorMessage(error)) },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Roles' }]}
        title="Roles"
        description="Administra los roles del sistema y sus permisos."
        action={
          <Button
            type="button"
            onClick={handleCreateRole}
            className="h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
          >
            <Plus className="size-4" />
            Nuevo Rol
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <RolesKpiRow filters={filters} onFiltersChange={handleFiltersChange} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar bare filters={<RoleFilters filters={filters} onFiltersChange={handleFiltersChange} />} />
        </div>

        {isLoading && (
          <div className="p-4">
            <LoadingState message="Cargando roles..." />
          </div>
        )}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los roles.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <RolesTable
              roles={data?.data ?? []}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onRowClick={setDrawerRole}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={setPage} itemLabel="roles" />
              </div>
            )}
          </div>
        )}
      </div>

      <RoleDrawer
        role={drawerRole}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerRole(null)
          }
        }}
        onEdit={(role) => {
          setDrawerRole(null)
          handleEdit(role)
        }}
      />
    </div>
  )
}
