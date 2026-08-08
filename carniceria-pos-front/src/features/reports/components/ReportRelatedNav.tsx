import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { REPORT_NAV_ITEMS, type ReportGroup } from '../constants/reportNav'

interface ReportRelatedNavProps {
  /** Id del reporte actual (`ReportNavItem.id`) — se excluye de la lista,
   * el usuario ya está en esa página. */
  currentId: string
  /** Grupo temático del reporte actual — solo se muestran los demás
   * reportes del MISMO grupo (mismo criterio que la navegación agrupada
   * del Centro de Análisis, `ReportsIndexPage.tsx`). */
  group: ReportGroup
}

/**
 * features/reports/components/ReportRelatedNav.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado, "navegación rápida entre reportes
 * relacionados"): franja compacta al pie de cada página de reporte con
 * los demás reportes de su mismo grupo temático — mismos 9 destinos ya
 * definidos en `reportNav.ts` (fuente única, también usada por el índice),
 * sin ninguna ruta/permiso nuevo. Se omite por completo si el grupo no
 * tiene más reportes además del actual (no ocurre hoy, los 3 grupos
 * tienen 3+ miembros, pero el componente queda correcto igual).
 */
export function ReportRelatedNav({ currentId, group }: ReportRelatedNavProps) {
  const related = REPORT_NAV_ITEMS.filter((item) => item.group === group && item.id !== currentId)

  if (related.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Reportes relacionados
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-md"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <item.icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.description}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </div>
    </div>
  )
}
