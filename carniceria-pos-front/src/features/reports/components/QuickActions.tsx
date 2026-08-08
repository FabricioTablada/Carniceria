import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import type { Permission } from '@/constants/permissions'

/**
 * features/reports/components/QuickActions.tsx
 * -----------------------------------------------------------------------------
 * Componente de presentacion pura: recibe `actions` ya resueltas por props,
 * sin llamar a ningun hook ni API por si mismo — mismo criterio ya usado en
 * `NotificationPanel.tsx`.
 *
 * No navega por si mismo: cada accion expone su propio `onClick`, resuelto
 * por quien lo usa (`DashboardPage.tsx`), mismo criterio de responsabilidad
 * ya aplicado en el resto de bloques del Dashboard.
 *
 * Cada accion se envuelve en `Can` para ocultarse si el usuario autenticado
 * no tiene el permiso asociado (mismo guard ya usado en `Sidebar`/`navigation.ts`).
 *
 * `id` es el identificador estable para `key` (no `label`, que es texto de
 * presentacion y podria cambiar o repetirse).
 *
 * Sin `Card` propio: el wrapper visual lo decide quien lo use (mismo criterio
 * que `SalesByCategoryChart.tsx`).
 *
 * Rediseño del Dashboard (aprobado): pasa de una grilla tipo tarjeta
 * (`grid grid-cols-2 sm:grid-cols-4`, botones cuadrados con borde) a una
 * toolbar horizontal de pastillas (`flex flex-wrap`) — misma lista de
 * `actions`, mismo `Can`/`onClick`/permiso por accion, solo cambia la
 * presentacion para que se sienta como herramientas y no como otra fila
 * de tarjetas.
 */

export interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  permission: Permission
  onClick: () => void
}

interface QuickActionsProps {
  actions: QuickAction[]
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {actions.map((action) => (
        <Can key={action.id} permission={action.permission}>
          <Button
            variant="ghost"
            onClick={action.onClick}
            className="h-11 gap-2.5 rounded-full border border-border/60 bg-card px-4 text-sm font-semibold text-foreground/80 shadow-sm transition-all duration-200 ease-out hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
          >
            <action.icon className="size-4 shrink-0" />
            <span className="truncate">{action.label}</span>
          </Button>
        </Can>
      ))}
    </div>
  )
}