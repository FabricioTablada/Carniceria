import { useState } from 'react'
import { Ban, CircleCheck, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { PERMISSIONS } from '@/constants/permissions'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { UserAvatar } from './UserAvatar'
import { UserRoleBadge } from './UserRoleBadge'
import { UserStatusBadge } from './UserStatusBadge'
import type { User } from '../types/user.types'
import type { ReactNode } from 'react'

interface UsersTableProps {
  /** Usuarios a mostrar. La tabla no obtiene datos por si misma. */
  users: User[]
  /** Mensaje mostrado cuando `users` esta vacio. */
  emptyMessage?: ReactNode
  /** Id del usuario autenticado (`useAuthStore`, resuelto por
   * `UsersPage.tsx`) — bloque "autoproteccion": la propia fila muestra
   * "Tú" y no puede activarse/desactivarse desde acá. */
  currentUserId?: string
  /** Se dispara al presionar la accion de editar un usuario. */
  onEdit?: (user: User) => void
  /** Se dispara al confirmar la accion de activar/desactivar un usuario. */
  onToggleStatus?: (user: User) => void
  /** Bloque Usuarios (aprobado, "el clic sobre una fila debe abrir el
   * Drawer") — mismo `onRowClick` ya soportado por `DataTable.tsx`
   * (Categorías/Proveedores ya lo usan). Opcional: sin este prop, la fila
   * sigue sin ser clickeable, igual que antes de este bloque. */
  onRowClick?: (user: User) => void
}

/**
 * features/users/components/UsersTable.tsx
 * -----------------------------------------------------------------------------
 * Canvas Workspace Usuarios (aprobado): `sortValue` en Nombre completo/
 * Usuario/Rol/Estado/Último acceso — mismo estándar de ordenamiento
 * reutilizable del resto del ERP (`DataTable.tsx`, "Workspace
 * Promociones"). "Correo" queda sin ordenar (nullable, bajo valor —
 * mismo criterio que "Ref." en otras tablas). Acciones ahora visibles
 * solo al pasar el mouse sobre la fila (`opacity-0 group-hover:opacity-100`,
 * mismo patrón ya usado en `PurchasesTable.tsx`/`InventoryTable.tsx`) en
 * vez de estar siempre visibles — mismos dos botones de siempre (Editar/
 * Activar-Desactivar), sin agregar un menú nuevo.
 *
 * "Último acceso" pasa de una sola línea (tiempo relativo) a dos: tiempo
 * relativo arriba, fecha/hora completa abajo en texto más chico — mismo
 * dato de siempre (`user.lastLoginAt`), sin ningún cálculo nuevo
 * (`formatRelativeTime`/`formatDateTime`, ambos ya existentes).
 */
export function UsersTable({
  users,
  emptyMessage = 'No hay usuarios para mostrar.',
  currentUserId,
  onEdit,
  onToggleStatus,
  onRowClick,
}: UsersTableProps) {
  // Mismo criterio ya usado en SuppliersTable.tsx/CategoriesTable.tsx/
  // TaxesTable.tsx/ProductsTable.tsx: el estado de "pendiente de
  // confirmar" vive aqui, junto al dialogo — no en ConfirmDialog
  // (generico y sin estado propio) ni en UsersPage.tsx (que solo
  // resuelve la mutacion real, via onToggleStatus, al confirmar).
  const [pendingToggle, setPendingToggle] = useState<User | null>(null)

  const handleToggleStatusClick = (user: User) => {
    setPendingToggle(user)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const columns: DataTableColumn<User>[] = [
    {
      header: 'Nombre completo',
      sortValue: (user) => user.fullName,
      render: (user) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar userId={user.id} fullName={user.fullName} size="sm" />
          <span className="flex items-center gap-1.5">
            {user.fullName}
            {user.id === currentUserId && (
              <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide text-brand uppercase">
                Tú
              </span>
            )}
          </span>
        </div>
      ),
      className: 'text-[0.9375rem] font-semibold',
    },
    {
      header: 'Usuario',
      sortValue: (user) => user.username,
      render: (user) => user.username,
      className: 'text-muted-foreground',
    },
    {
      header: 'Correo',
      render: (user) => user.email ?? '—',
      className: 'text-muted-foreground',
    },
    {
      header: 'Rol',
      sortValue: (user) => user.role.name,
      render: (user) => <UserRoleBadge role={user.role} />,
    },
    {
      header: 'Estado',
      sortValue: (user) => (user.active ? 1 : 0),
      render: (user) => <UserStatusBadge active={user.active} />,
      className: 'align-middle',
    },
    {
      header: 'Último acceso',
      sortValue: (user) => (user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0),
      render: (user) =>
        user.lastLoginAt ? (
          <div className="flex flex-col">
            <span>{formatRelativeTime(user.lastLoginAt)}</span>
            <span className="text-xs text-muted-foreground/80">{formatDateTime(user.lastLoginAt)}</span>
          </div>
        ) : (
          '—'
        ),
      className: 'text-muted-foreground',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (user) => (
        <Can permission={PERMISSIONS.USERS_MANAGE}>
          {/* `onRowClick` de la fila (abre el Drawer) no debe dispararse
              al usar estos botones — mismo criterio ya documentado en
              `DataTable.tsx` ("responsabilidad de quien define la
              columna de acciones"). */}
          <div
            className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Editar ${user.fullName}`}
              onClick={() => onEdit?.(user)}
              className="rounded-lg text-muted-foreground transition-all duration-150 hover:bg-brand/10 hover:text-brand"
            >
              <Pencil className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={user.id === currentUserId}
              title={user.id === currentUserId ? 'No podés desactivar tu propia cuenta' : undefined}
              aria-label={
                user.active
                  ? `Desactivar ${user.fullName}`
                  : `Activar ${user.fullName}`
              }
              onClick={() => handleToggleStatusClick(user)}
              className={
                user.active
                  ? 'rounded-lg text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive'
                  : 'rounded-lg text-muted-foreground transition-all duration-150 hover:bg-success/10 hover:text-success'
              }
            >
              {user.active ? (
                <Ban className="size-4" />
              ) : (
                <CircleCheck className="size-4" />
              )}
            </Button>
          </div>
        </Can>
      ),
      className: 'align-middle',
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        getRowKey={(user) => user.id}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        initialSort={{ header: 'Último acceso', direction: 'desc' }}
        tableClassName="border-border/60 shadow-sm"
        headerClassName="px-5 py-4 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
        rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
        cellClassName="px-5 py-4"
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={pendingToggle?.active ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          pendingToggle
            ? pendingToggle.active
              ? `¿Seguro que querés desactivar a "${pendingToggle.fullName}"?`
              : `¿Seguro que querés activar a "${pendingToggle.fullName}"?`
            : undefined
        }
        confirmText={pendingToggle?.active ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
        onConfirm={handleConfirmToggle}
      />
    </>
  )
}
