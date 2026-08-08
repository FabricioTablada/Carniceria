import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Users as UsersIcon } from 'lucide-react'
import { Can } from '@/components/common/Can'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { PERMISSIONS } from '@/constants/permissions'
import { usePagination } from '@/hooks/usePagination'
import { useAuthStore } from '@/stores/authStore'
import { useRoles } from '@/features/roles/hooks/useRoles'
import { useUsers } from '../hooks/useUsers'
import { useUpdateUserStatus } from '../hooks/useUpdateUserStatus'
import { UserFilters } from '../components/UserFilters'
import { UserDrawer } from '../components/UserDrawer'
import { UsersKpiRow } from '../components/UsersKpiRow'
import { UsersTable } from '../components/UsersTable'
import { UsersTableSkeleton } from '../components/UsersTableSkeleton'
import { getUserErrorMessage } from '../utils/userErrors'
import type { User, UserFilters as UserFiltersValue } from '../types/user.types'

/**
 * features/users/pages/UsersPage.tsx
 * -----------------------------------------------------------------------------
 * Canvas Workspace Usuarios (aprobado, "exactamente el mismo lenguaje
 * visual que Compras/Inventario/Productos"): adopta el mismo Workspace
 * único de `CategoriesPage.tsx`/`ProductsPage.tsx` — un solo contenedor
 * exterior (`rounded-2xl border bg-card shadow-sm`, sin `overflow-hidden`
 * propio), con KPIs/Toolbar/Tabla/Paginación como franjas internas
 * separadas por `border-b`/`border-t`, en vez de piezas independientes
 * apiladas. "Nuevo usuario" se queda en `PageHeader.action` (mismo
 * criterio que Compras/Inventario, a diferencia de Categorías) — la
 * Toolbar contiene únicamente filtros.
 */
export function UsersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Rediseño de Roles (aprobado, "Ver todos en Usuarios" desde el Drawer
  // de un rol): mismo mecanismo ya usado por `ProductsPage.tsx` para
  // `categoryId`/`taxId` — se lee una única vez, al montar, como valor
  // inicial de `UserFiltersValue` (que ya soporta `roleId`, usado hoy solo
  // por el `<Select>` de `UserFilters.tsx`). Quien llega por el menú
  // normal (sin `state`) sigue arrancando con filtros vacíos.
  const [filters, setFilters] = useState<UserFiltersValue>(() => {
    const navigationState = location.state as { roleId?: string } | null
    return navigationState?.roleId ? { roleId: navigationState.roleId } : {}
  })
  // Bloque Usuarios (aprobado, "el clic sobre una fila debe abrir el
  // Drawer") — mismo criterio ya usado en Categorías/Proveedores:
  // `null` cierra el panel, un `User` lo abre.
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Arquitectura de listados, Bloque 4: `usePagination`/`Pagination`
  // agregan paginacion real — antes esta pagina nunca enviaba `page` ni
  // `limit`, quedando fija en la primera pagina (20 registros por defecto
  // del backend).
  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useUsers({ ...filters, page })
  const { mutate: updateUserStatus } = useUpdateUserStatus()
  const currentUser = useAuthStore((state) => state.user)

  // Bloque Usuarios (aprobado, "reparar el filtro por Rol"): mismo
  // `useRoles({ active: true })` que ya usan `CreateUserPage.tsx`/
  // `EditUserPage.tsx` para el selector del formulario — antes
  // `UsersPage.tsx` nunca se lo pasaba a `UserFilters`, que quedaba
  // siempre mostrando únicamente "Todos los roles". Se reutiliza también
  // para resolver los permisos del rol de este usuario en
  // `UserDrawer.tsx`, sin una segunda consulta.
  const { data: rolesResponse } = useRoles({ active: true })
  const roles = rolesResponse?.data ?? []

  const hasActiveFilters = Boolean(
    filters.search || filters.roleId !== undefined || filters.active !== undefined,
  )

  // Cualquier cambio de filtro vuelve a la pagina 1, mismo criterio que
  // ProductsPage.tsx.
  const handleFiltersChange = (nextFilters: UserFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
  }

  const handleResetFilters = () => handleFiltersChange({})

  // Canvas Workspace Usuarios (aprobado): las celdas "Activos"/
  // "Inactivos" de `UsersKpiRow.tsx` aplican el filtro "Estado" — mismo
  // `handleFiltersChange` que ya usa `UserFilters`, sin logica de
  // filtrado nueva. Mismo patron exacto que `handleKpiStatusSelect` en
  // `CategoriesPage.tsx`/`ProductsPage.tsx`.
  const handleKpiStatusSelect = (active: boolean | undefined) => {
    handleFiltersChange({ ...filters, active })
  }

  const handleCreateUser = () => {
    navigate('/users/new')
  }

  const handleEdit = (user: User) => {
    navigate(`/users/${user.id}/edit`)
  }

  const handleToggleStatus = (user: User) => {
    updateUserStatus(
      { id: user.id, dto: { active: !user.active } },
      { onError: (error) => toast.error(getUserErrorMessage(error)) },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Administra los usuarios del sistema."
        action={
          <Can permission={PERMISSIONS.USERS_MANAGE}>
            <Button
              type="button"
              onClick={handleCreateUser}
              className="h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              <Plus className="size-4" />
              Nuevo usuario
            </Button>
          </Can>
        }
      />

      {/* Canvas Workspace Usuarios (aprobado): KPIs, filtros, tabla y
          paginación pasan a ser franjas de UNA sola superficie — mismo
          contenedor exacto que `CategoriesPage.tsx`/`ProductsPage.tsx`
          (`rounded-2xl border bg-card shadow-sm`, sin `overflow-hidden`
          propio). */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <UsersKpiRow activeFilter={filters.active} onSelectActive={handleKpiStatusSelect} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar bare filters={<UserFilters filters={filters} roles={roles} onChange={handleFiltersChange} onReset={handleResetFilters} />} />
        </div>

        {isLoading && <UsersTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los usuarios.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={isFetching ? 'opacity-60 transition-opacity duration-200' : undefined}>
            <UsersTable
              users={data?.data ?? []}
              currentUserId={currentUser?.id}
              emptyMessage={
                hasActiveFilters ? (
                  <EmptyState
                    icon={UsersIcon}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar la búsqueda o los filtros seleccionados."
                    action={{ label: 'Limpiar filtros', onClick: handleResetFilters }}
                  />
                ) : (
                  <EmptyState
                    icon={UsersIcon}
                    title="Todavía no hay usuarios"
                    description="Creá el primer usuario para empezar a administrar accesos."
                    action={{ label: 'Nuevo usuario', onClick: handleCreateUser, variant: 'brand' }}
                  />
                )
              }
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onRowClick={setSelectedUser}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={setPage} itemLabel="usuarios" />
              </div>
            )}
          </div>
        )}
      </div>

      <UserDrawer
        user={selectedUser}
        roles={roles}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null)
          }
        }}
        onEdit={handleEdit}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  )
}
