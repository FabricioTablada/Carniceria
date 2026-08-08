import { useState } from 'react'
import { Eye, Pencil, ShieldCheck, User as UserIcon } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { RolePermissionsPreview } from '@/features/users/components/RolePermissionsPreview'
import { RoleUsersCount } from './RoleUsersCount'
import type { Role } from '../types/role.types'

interface RolesTableProps {
  roles: Role[]
  emptyMessage?: string
  onEdit?: (role: Role) => void
  onToggleStatus?: (role: Role) => void
  /** Bloque Roles (rediseño, aprobado): abre `RoleDrawer.tsx` — mismo
   * criterio de vista rápida ya usado por `ProductsTable`/`PermissionTable`. */
  onRowClick?: (role: Role) => void
}

/**
 * features/roles/components/RolesTable.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Roles (aprobado, "mismo Switch Activo/Inactivo que Productos
 * y Usuarios, no crear otro componente"): el toggle de estado deja de vivir
 * en el `RowMenu` y pasa a ser el mismo `Switch` inline (chip verde/rojo,
 * `data-[checked]:bg-success data-[unchecked]:bg-destructive`) copiado
 * literal de `ProductsTable.tsx` — abre el mismo `ConfirmDialog` de
 * siempre, nunca aplica el cambio directamente. `sortValue` agregado a
 * Nombre/Usuarios/Tipo/Estado (mismo estándar de ordenamiento del resto
 * del ERP). Columna "Usuarios" nueva (`RoleUsersCount`, ver ese archivo).
 * "Tipo" (antes "Sistema": Sí/No) ahora es un badge con ícono, más legible
 * de un vistazo ("Sistema" con `ShieldCheck` / "Personalizado" con
 * `UserIcon`) — mismo `Badge` compartido, sin variante nueva.
 */
export function RolesTable({
  roles,
  emptyMessage = 'No hay roles para mostrar.',
  onEdit,
  onToggleStatus,
  onRowClick,
}: RolesTableProps) {
  // Mismo criterio ya usado en SuppliersTable.tsx/CategoriesTable.tsx/
  // TaxesTable.tsx/ProductsTable.tsx/UsersTable.tsx: el estado de
  // "pendiente de confirmar" vive aqui, junto al dialogo — no en
  // ConfirmDialog (generico y sin estado propio) ni en RolesPage.tsx
  // (que solo resuelve la mutacion real, via onToggleStatus, al
  // confirmar).
  const [pendingToggle, setPendingToggle] = useState<Role | null>(null)

  const handleToggleStatusClick = (role: Role) => {
    setPendingToggle(role)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const columns: DataTableColumn<Role>[] = [
    {
      header: 'Nombre',
      render: (role) => role.name,
      sortValue: (role) => role.name,
      className: 'text-[0.9375rem] font-semibold',
    },
    {
      header: 'Descripción',
      render: (role) => role.description ?? '—',
      className: 'max-w-72 truncate text-muted-foreground',
    },
    {
      // Bloque Roles (rediseño, aprobado): `role.permissions[]` ya viaja
      // completo en la respuesta de `GET /roles` (`role.types.ts`) — se
      // reutiliza `RolePermissionsPreview.tsx` (ya construido para
      // `UserForm.tsx`/`UserDrawer.tsx`) tal cual, sin ningún request
      // nuevo. `maxVisible` más chico que el default (4): la columna de
      // una tabla es más angosta que el body de un Drawer.
      header: 'Permisos',
      render: (role) => <RolePermissionsPreview permissions={role.permissions} maxVisible={2} />,
      className: 'max-w-72',
    },
    {
      header: 'Usuarios',
      render: (role) => <RoleUsersCount roleId={role.id} />,
      className: 'text-right whitespace-nowrap tabular-nums',
      headerClassName: 'text-right',
    },
    {
      header: 'Tipo',
      render: (role) =>
        role.isSystem ? (
          <Badge variant="accent" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Sistema
          </Badge>
        ) : (
          <Badge variant="muted" className="gap-1.5">
            <UserIcon className="size-3.5" />
            Personalizado
          </Badge>
        ),
      sortValue: (role) => (role.isSystem ? 1 : 0),
      className: 'align-middle',
    },
    {
      // Mismo patrón exacto que `ProductsTable.tsx`: chip con `Switch`,
      // fondo tenue verde/rojo, centrado en su columna. El switch solo
      // abre `ConfirmDialog` — nunca aplica el cambio directamente.
      header: 'Estado',
      sortValue: (role) => (role.active ? 1 : 0),
      headerClassName: 'min-w-[9.5rem] text-center',
      render: (role) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-4 py-2',
              role.active ? 'bg-success/8' : 'bg-destructive/8',
            )}
          >
            <Switch
              checked={role.active}
              disabled={role.isSystem}
              title={role.isSystem ? 'No se puede desactivar un rol de sistema.' : undefined}
              onCheckedChange={() => handleToggleStatusClick(role)}
              aria-label={role.active ? `Desactivar ${role.name}` : `Activar ${role.name}`}
              className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
            />
            <span
              className={cn('text-sm font-medium', role.active ? 'text-success' : 'text-destructive')}
            >
              {role.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[9.5rem] align-middle',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (role) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <RowMenu label={`Acciones para ${role.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(role)}>
              Ver detalle
            </RowMenuItem>
            <RowMenuItem icon={Pencil} onClick={() => onEdit?.(role)}>
              Editar
            </RowMenuItem>
          </RowMenu>
        </div>
      ),
      className: 'align-middle',
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={roles}
        getRowKey={(role) => role.id}
        emptyMessage={emptyMessage}
        tableClassName="border-border/60 shadow-sm"
        headerClassName="px-5 py-4 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
        rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
        cellClassName="px-5 py-4"
        onRowClick={onRowClick}
        initialSort={{ header: 'Nombre', direction: 'asc' }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={pendingToggle?.active ? 'Desactivar rol' : 'Activar rol'}
        description={
          pendingToggle
            ? pendingToggle.active
              ? `¿Seguro que querés desactivar "${pendingToggle.name}"?`
              : `¿Seguro que querés activar "${pendingToggle.name}"?`
            : undefined
        }
        confirmText={pendingToggle?.active ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
        onConfirm={handleConfirmToggle}
      />
    </>
  )
}
