import { ExternalLink, Pencil, TriangleAlert, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { LoadingState } from '@/components/ui/LoadingState'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/Tabs'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'
import { formatDateTime } from '@/utils/formatDateTime'
import { groupPermissionsByModule } from '@/utils/permissionModule'
import { useUsers } from '@/features/users/hooks/useUsers'
import { RolePermissionsPreview } from '@/features/users/components/RolePermissionsPreview'
import type { User } from '@/features/users/types/user.types'
import type { Role } from '../types/role.types'

interface RoleDrawerProps {
  /** Rol a mostrar. `null` cierra el panel (mismo criterio que
   * `CategoryDrawer.tsx`/`TaxDrawer.tsx`/`PermissionDrawer.tsx`). */
  role: Role | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion —
   * mismo criterio que el resto de los Drawers del proyecto ("el Drawer
   * nunca edita datos por si mismo"). */
  onEdit: (role: Role) => void
}

/** Mismo par etiqueta/valor que `SaleDetailContent.tsx`/`PurchaseDetailPage.tsx`
 * — banda de identidad del detalle. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

/**
 * features/roles/components/RoleDrawer.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Roles (aprobado, "modernizar completamente el Drawer
 * siguiendo el estándar actual del ERP"): pasa del bloque único de
 * secciones apiladas (una sola tarjeta de scroll largo) a la MISMA banda
 * de identidad + hero + `Tabs` que ya usan `SaleDetailContent.tsx`/
 * `PurchaseDetailPage.tsx`/`CashSessionDetailDrawer.tsx` — campos simples
 * (`Field`, mismo componente local replicado en esos archivos) a la
 * izquierda, hero de "Usuarios asignados" a la derecha, 3 pestañas
 * (Resumen/Permisos/Usuarios) debajo. Ningún dato nuevo: mismos campos que
 * ya mostraba el Drawer anterior, reorganizados.
 *
 * "Usuarios asociados" (pestaña nueva): `useUsers({ roleId })`, mismo
 * hook/endpoint que ya usa `UsersPage.tsx` — sin límite defensivo especial
 * (un rol rara vez tiene cientos de usuarios). El hero de "Usuarios
 * asignados" reutiliza la MISMA consulta (misma query key en React Query,
 * sin petición duplicada) que la pestaña, pidiendo `limit: 1` cuando solo
 * hace falta el total — dos componentes, un solo dato cacheado.
 *
 * "Permisos" (pestaña): mismo agrupamiento por módulo que
 * `RolePermissionSelector.tsx`/`PermissionTable.tsx` (`groupPermissionsByModule`,
 * `utils/permissionModule.ts`) pero de SOLO LECTURA — sin checkboxes, sin
 * buscador, sin "Seleccionar todo" (esas acciones siguen siendo exclusivas
 * de la edición, `RolePermissionsSection` en `EditRolePage.tsx`).
 *
 * Extraído en `RoleDrawerContent` (subcomponente, solo montado cuando
 * `role` existe): sus hooks de datos (`useUsers`) no deben ejecutarse con
 * `role: null` — mismo patrón ya usado en `CashSessionDetailDrawer.tsx`.
 */
export function RoleDrawer({ role, onOpenChange, onEdit }: RoleDrawerProps) {
  return (
    <WorkspacePanel open={role !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="md">
        {role && <RoleDrawerContent role={role} onEdit={onEdit} />}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}

function RoleDrawerContent({ role, onEdit }: { role: Role; onEdit: (role: Role) => void }) {
  const { data: usersResponse, isLoading: isLoadingUsers } = useUsers({ roleId: role.id })
  const users = usersResponse?.data ?? []
  const usersTotal = usersResponse?.meta.total ?? 0

  const permissionGroups = groupPermissionsByModule(role.permissions)

  return (
    <>
      <WorkspacePanelHeader>
        <div className="flex items-center gap-2.5">
          <WorkspacePanelTitle>{role.name}</WorkspacePanelTitle>
          <ActiveStatusBadge active={role.active} />
        </div>
      </WorkspacePanelHeader>

      <WorkspacePanelBody className="flex flex-col gap-4">
        {role.isSystem && (
          <div className="flex items-start gap-2 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-3 py-2.5 text-sm text-accent-amber-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-amber" />
            <p>
              Este es un rol del sistema. Editarlo o desactivarlo puede afectar el acceso de otros
              usuarios.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-6">
            <Field label="Tipo" value={role.isSystem ? 'Rol del sistema' : 'Rol personalizado'} />
            <Field label="Creado" value={formatDateTime(role.createdAt)} />
            <Field label="Última actualización" value={formatDateTime(role.updatedAt)} />
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3 sm:min-w-44">
            <span className="text-xs font-semibold tracking-wide text-brand/80 uppercase">
              Usuarios asignados
            </span>
            <span className="text-2xl leading-tight font-bold tabular-nums text-brand">
              {isLoadingUsers ? '—' : usersTotal}
            </span>
          </div>
        </div>

        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTab value="summary">Resumen</TabsTab>
            <TabsTab value="permissions">Permisos ({role.permissions.length})</TabsTab>
            <TabsTab value="users">Usuarios{usersTotal > 0 ? ` (${usersTotal})` : ''}</TabsTab>
          </TabsList>

          <TabsPanel value="summary" className="flex flex-col gap-4 pt-4">
            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Descripción
              </h3>
              <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                {role.description ?? <span className="text-muted-foreground">Sin descripción</span>}
              </p>
            </div>

            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Permisos
              </h3>
              <RolePermissionsPreview permissions={role.permissions} maxVisible={8} />
            </div>
          </TabsPanel>

          <TabsPanel value="permissions" className="pt-4">
            {permissionGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este rol no tiene permisos asignados.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {permissionGroups.map((group) => (
                  <details
                    key={group.moduleKey}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 p-3"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground select-none [&::-webkit-details-marker]:hidden">
                      {group.label}
                      <span className="font-normal text-muted-foreground">({group.items.length})</span>
                    </summary>
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {group.items.map((permission) => (
                        <Badge key={permission.id} variant="accent">
                          {permission.code}
                        </Badge>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </TabsPanel>

          <TabsPanel value="users" className="flex flex-col gap-3 pt-4">
            <RoleUsersTab role={role} users={users} isLoading={isLoadingUsers} />
          </TabsPanel>
        </Tabs>
      </WorkspacePanelBody>

      <WorkspacePanelFooter>
        <WorkspacePanelClose
          render={
            <Button type="button" variant="outline">
              Cerrar
            </Button>
          }
        />
        <Button
          type="button"
          onClick={() => onEdit(role)}
          className="gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
        >
          <Pencil className="size-4" />
          Editar rol
        </Button>
      </WorkspacePanelFooter>
    </>
  )
}

/**
 * Pestaña "Usuarios asociados" — presentación limpia (nombre + usuario +
 * estado) en vez de una tabla administrativa completa: este es un
 * subconjunto de solo lectura dentro de un panel angosto, no un listado
 * para operar. "Ver todos en Usuarios" navega a `/users` con el rol
 * preseleccionado en el filtro (mismo `UserFilters.roleId` ya existente).
 */
function RoleUsersTab({ role, users, isLoading }: { role: Role; users: User[]; isLoading: boolean }) {
  const navigate = useNavigate()

  const columns: DataTableColumn<User>[] = [
    {
      header: 'Usuario',
      render: (user) => (
        <div className="flex flex-col">
          <span className="font-medium">{user.fullName}</span>
          <span className="text-xs text-muted-foreground">@{user.username}</span>
        </div>
      ),
    },
    {
      header: 'Estado',
      render: (user) => <ActiveStatusBadge active={user.active} />,
      className: 'align-middle',
    },
  ]

  if (isLoading) {
    return <LoadingState message="Cargando usuarios..." />
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {users.length === 1 ? '1 usuario con este rol' : `${users.length} usuarios con este rol`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => navigate('/users', { state: { roleId: role.id } })}
        >
          Ver todos en Usuarios
          <ExternalLink className="size-3.5" />
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin usuarios asignados"
          description="Todavía ningún usuario del sistema tiene este rol."
        />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          getRowKey={(user) => user.id}
          tableClassName="border-border/60 shadow-sm"
          headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
          cellClassName="px-4 py-3"
        />
      )}
    </>
  )
}
