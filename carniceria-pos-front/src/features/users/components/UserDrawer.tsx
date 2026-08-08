import { useState } from 'react'
import { Ban, CircleCheck, Pencil, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { useAuthStore } from '@/stores/authStore'
import { useAuditLogs } from '@/features/audit/hooks/useAuditLogs'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { UserAvatar } from './UserAvatar'
import { UserRoleBadge } from './UserRoleBadge'
import { UserStatusBadge } from './UserStatusBadge'
import { RolePermissionsPreview } from './RolePermissionsPreview'
import type { Role } from '@/features/roles/types/role.types'
import type { User } from '../types/user.types'
import type { ReactNode } from 'react'

interface UserDrawerProps {
  /** Usuario a mostrar. `null` cierra el panel (mismo criterio que el
   * resto de los Drawers del ERP). */
  user: User | null
  /** Roles activos, ya obtenidos por `UsersPage.tsx` (mismo `useRoles`
   * que alimenta el filtro de rol) — se reutilizan para resolver los
   * permisos del rol de este usuario, sin ninguna consulta nueva. */
  roles: Role[]
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion —
   * mismo criterio que `CategoryDrawer.tsx`/`SupplierDrawer.tsx` (el
   * Drawer nunca edita datos por si mismo). */
  onEdit: (user: User) => void
  onToggleStatus: (user: User) => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

/**
 * Canvas Workspace Usuarios (aprobado, "resumen superior"): franja
 * compacta de 4 datos (Rol/Estado/Último acceso/Fecha de creación) justo
 * debajo del hero de identidad — mismos datos/formatters de siempre
 * (`user.role`/`user.active`/`formatRelativeTime`/`formatDateTime`), sin
 * ningún cálculo nuevo. Rol/Estado ya aparecen como badges en el hero;
 * esta franja los repite a propósito, junto a Último acceso/Creado, para
 * un vistazo rápido sin tener que leer las secciones de abajo — mismo
 * criterio de "resumen ejecutivo antes del detalle" ya usado en el hero
 * de `PurchaseDetailPage.tsx`/`InventoryAdjustDrawer.tsx`.
 */
function UserSummaryStrip({ user }: { user: User }) {
  return (
    <div className="grid grid-cols-2 gap-4 border-b border-border bg-muted/20 px-6 py-4 sm:grid-cols-4">
      <SummaryStat label="Rol" value={<UserRoleBadge role={user.role} />} />
      <SummaryStat label="Estado" value={<UserStatusBadge active={user.active} />} />
      <SummaryStat label="Último acceso" value={formatRelativeTime(user.lastLoginAt)} />
      <SummaryStat label="Creado" value={formatDateTime(user.createdAt)} />
    </div>
  )
}

/**
 * Tarjeta de actividad (aprobado, "tarjeta de actividad en el Drawer"):
 * Creado/Último acceso siempre visibles (mismos campos de `User`, sin
 * cambios). "Última modificación" reutiliza `user.updatedAt` (ya
 * existente) — "modificado por" es un dato ADICIONAL, solo se muestra si
 * se puede resolver: reutiliza `GET /audit` (`useAuditLogs`, ya
 * construido y consumido por `PurchaseDetailPage.tsx`) filtrando por esta
 * entidad, sin ningun endpoint nuevo. Mismo criterio de acceso ya
 * establecido para ese endpoint (restringido a `ADMIN` en el backend,
 * `audit.types.ts`): se consulta solo si el usuario autenticado es
 * `ADMIN`, igual que ya hace `PurchaseDetailPage.tsx` — para cualquier
 * otro rol, la fila "Última modificación" simplemente no incluye el
 * "por quién" (no es un dato inventado, es un dato al que ese rol no
 * tiene acceso).
 */
function UserActivitySection({ user }: { user: User }) {
  const currentUser = useAuthStore((state) => state.user)
  const isAdmin = currentUser?.role === 'ADMIN'

  const { data: auditResponse } = useAuditLogs(
    isAdmin
      ? { entity: 'User', entityId: user.id, action: 'UPDATE', limit: 1 }
      : { entityId: undefined },
  )
  const lastModifiedBy = auditResponse?.data[0]?.user?.fullName

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Actividad
      </h3>
      <div className="divide-y divide-border">
        <InfoRow label="Usuario desde" value={formatDateTime(user.createdAt)} />
        <InfoRow label="Último acceso" value={formatRelativeTime(user.lastLoginAt)} />
        <InfoRow
          label="Última modificación"
          value={
            lastModifiedBy
              ? `${formatRelativeTime(user.updatedAt)} · ${lastModifiedBy}`
              : formatRelativeTime(user.updatedAt)
          }
        />
      </div>
    </section>
  )
}

/**
 * features/users/components/UserDrawer.tsx
 * -----------------------------------------------------------------------------
 * Bloque Usuarios (aprobado): adaptacion del estandar ya usado en
 * `CategoryDrawer.tsx`/`SupplierDrawer.tsx`/`TaxDrawer.tsx` — construido
 * sobre `WorkspacePanel.tsx` (mismo primitivo, sin reinventar nada). Se
 * abre al hacer clic en una fila de `UsersTable.tsx` (`onRowClick`, ya
 * soportado por `DataTable`), la edicion completa sigue siendo una
 * accion explicita ("Editar" aca navega a `EditUserPage.tsx`, el Drawer
 * nunca edita datos por si mismo).
 *
 * Avatar grande (`UserAvatar`, iniciales + color determinístico) en vez
 * de un icono generico — Usuarios es el primer modulo con "identidad de
 * persona", a diferencia de Categorias/Impuestos/Proveedores (entidades
 * sin nombre propio de persona).
 *
 * Autoproteccion (aprobado, "un usuario no puede desactivarse a si
 * mismo"): guarda de UX que reutiliza el usuario autenticado ya
 * disponible en `useAuthStore` (sin ningun fetch nuevo) — si `user.id`
 * coincide con el usuario autenticado, el boton de Activar/Desactivar
 * queda deshabilitado con una explicacion visible, para dar
 * retroalimentacion inmediata sin esperar una respuesta del servidor.
 * QA.10: el backend (`users.service.ts::changeStatus`) ahora tiene la
 * misma validacion real (mismo criterio que el auto-cambio de ROL, ya
 * bloqueado desde antes) — esta guarda de UI deja de ser la unica
 * proteccion, pero se mantiene igual por la retroalimentacion inmediata.
 *
 * Activar/Desactivar pide confirmacion antes de ejecutar `onToggleStatus`
 * — mismo `ConfirmDialog` y el mismo criterio ya usado en
 * `UsersTable.tsx` (estado local, no en el padre), para que la accion se
 * sienta igual sin importar si se dispara desde la tabla o desde este
 * Drawer.
 */
export function UserDrawer({ user, roles, onOpenChange, onEdit, onToggleStatus }: UserDrawerProps) {
  const currentUser = useAuthStore((state) => state.user)
  const isSelf = Boolean(user && currentUser && user.id === currentUser.id)
  const role = user ? roles.find((candidate) => candidate.id === user.role.id) : undefined
  const [isConfirmingToggle, setIsConfirmingToggle] = useState(false)

  const handleConfirmToggle = () => {
    if (user) {
      onToggleStatus(user)
    }
    setIsConfirmingToggle(false)
  }

  return (
    <WorkspacePanel open={user !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {user && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <UserAvatar userId={user.id} fullName={user.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {user.fullName}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {user.username}
                  {user.email ? ` · ${user.email}` : ''}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <UserRoleBadge role={user.role} />
                  <UserStatusBadge active={user.active} />
                </div>
              </div>
            </WorkspacePanelHeader>

            <UserSummaryStrip user={user} />

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Acceso
                </h3>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  {role ? (
                    <RolePermissionsPreview permissions={role.permissions} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No se pudo cargar la información de permisos de este rol.
                    </p>
                  )}
                </div>
              </section>

              <UserActivitySection user={user} />

              {isSelf && (
                <div className="flex items-start gap-2 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-3 py-2.5 text-sm text-accent-amber-foreground">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-amber" />
                  <p>
                    No podés desactivar tu propia cuenta desde acá — pedile a otro administrador que lo
                    haga.
                  </p>
                </div>
              )}
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
                variant="outline"
                disabled={isSelf}
                title={isSelf ? 'No podés desactivar tu propia cuenta' : undefined}
                onClick={() => setIsConfirmingToggle(true)}
                className={
                  user.active
                    ? 'gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive'
                    : 'gap-2 text-success hover:bg-success/10 hover:text-success'
                }
              >
                {user.active ? <Ban className="size-4" /> : <CircleCheck className="size-4" />}
                {user.active ? 'Desactivar' : 'Activar'}
              </Button>
              <Button
                type="button"
                onClick={() => onEdit(user)}
                className="gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
              >
                <Pencil className="size-4" />
                Editar usuario
              </Button>
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>

      {user && (
        <ConfirmDialog
          open={isConfirmingToggle}
          onOpenChange={setIsConfirmingToggle}
          title={user.active ? 'Desactivar usuario' : 'Activar usuario'}
          description={
            user.active
              ? `¿Seguro que querés desactivar a "${user.fullName}"?`
              : `¿Seguro que querés activar a "${user.fullName}"?`
          }
          confirmText={user.active ? 'Desactivar' : 'Activar'}
          cancelText="Cancelar"
          onConfirm={handleConfirmToggle}
        />
      )}
    </WorkspacePanel>
  )
}
