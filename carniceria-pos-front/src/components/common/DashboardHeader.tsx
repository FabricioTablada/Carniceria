import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'

interface DashboardHeaderProps {
  /** Nombre completo del usuario autenticado, resuelto por `DashboardLayout.tsx`. */
  userFullName: string
  /** Rol del usuario, resuelto por `DashboardLayout.tsx`. */
  userRole: string
  /** Se dispara al presionar "Cerrar sesion". Misma logica de siempre
   * (authApi.logout() + authStore.logout() + navigate), resuelta por
   * DashboardLayout.tsx — mismo prop que antes recibia `Sidebar.tsx`. */
  onLogout: () => void
}

/**
 * components/common/DashboardHeader.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de layout (aprobado): encabezado del Backoffice. Vive DENTRO
 * del panel de contenido (`DashboardLayout.tsx`), como franja fija arriba
 * del área con scroll — mismo patrón ya aprobado de "header fijo + body
 * con scroll" que `WorkspacePanelHeader`/`WorkspacePanelBody`
 * (`components/ui/WorkspacePanel.tsx`), aplicado acá al panel principal
 * en vez de a un Drawer.
 *
 * Contiene el bloque de usuario + notificaciones + "Cerrar sesión" que
 * antes vivía en el pie de `Sidebar.tsx` — se mudó acá porque no cabe con
 * texto en un dock ultracompacto de 4.5rem. Misma información, mismos
 * componentes (`NotificationBell`), solo reubicados.
 *
 * Identidad visual: tokens propios del Backoffice (`bg-card`/`border`,
 * NO `--pos-*`) — el Backoffice y el POS mantienen identidades separadas
 * (decisión ya tomada). `NotificationBell` recibe `triggerClassName` para
 * un hover legible sobre fondo claro (por defecto asume fondo oscuro,
 * correcto para `PosHeader.tsx`).
 *
 * Buscador global eliminado (aprobado, "eliminar definitivamente el
 * buscador global en todo el ERP"): existía como elemento puramente
 * visual/preparatorio, sin `onChange` ni integración real, y ya se había
 * empezado a ocultar por página (`hideSearch`/`hideGlobalSearch`) para
 * Crear/Editar Producto. Se retira del todo — ya no hay una columna
 * central que ocultar, así que tampoco existe más esa prop (era
 * exclusivamente para eso). El header pasa de un grid de 3 columnas
 * (izquierda vacía + centro del buscador + derecha) a un único bloque
 * `flex justify-end`: el bloque de usuario queda siempre pegado al borde
 * derecho, sin ningún contenedor/placeholder vacío intermedio.
 */
export function DashboardHeader({ userFullName, userRole, onLogout }: DashboardHeaderProps) {
  const initials = userFullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <header className="flex shrink-0 items-center justify-end gap-2 border-b border-border bg-card px-6 py-3">
      <NotificationBell triggerClassName="hover:bg-muted" />

      <div className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
          {initials}
        </div>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className="truncate text-sm font-semibold text-foreground">{userFullName}</p>
          <p className="truncate text-xs text-muted-foreground">{userRole}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        className="shrink-0 text-muted-foreground transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="size-4" />
      </Button>
    </header>
  )
}
