import { Search } from 'lucide-react'
import { Badge } from './Badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface ReportSearchFieldProps {
  /** `id`/`htmlFor` del campo — unico por pantalla (ej.
   * "sales-report-filters-search"). */
  id: string
  /** Texto de ejemplo del input — el unico dato que varia entre reportes
   * (ej. "Buscar por documento, referencia o cliente..."). */
  placeholder: string
}

/**
 * components/common/ReportSearchField.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02 (correccion, previo a replicar el patron a Compras/
 * Inventario/Utilidad): campo "Buscar" deshabilitado + badge
 * "Próximamente", extraido de `SalesReportFilters.tsx` — es identico en
 * estructura para cualquier reporte de listado (ningun dato de Ventas),
 * la unica diferencia real entre modulos es el texto del `placeholder`.
 *
 * Existe visualmente para igualar el diseño aprobado, pero ningun reporte
 * expone hoy un filtro de busqueda por texto en el backend — por eso el
 * input esta deshabilitado, sin `value`/`onChange`: no sugiere una
 * capacidad que todavia no filtra nada real. El dia que un reporte
 * concreto sume soporte de busqueda, ESE modulo deja de usar este
 * componente (o este componente gana una variante habilitada) — no se
 * inventa ese comportamiento aca todavia.
 */
export function ReportSearchField({ id, placeholder }: ReportSearchFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
          Buscar
        </Label>
        <Badge variant="muted" className="px-1.5 py-0 text-[0.625rem]">
          Próximamente
        </Badge>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          disabled
          placeholder={placeholder}
          title="Próximamente: el backend todavía no soporta búsqueda por texto en este reporte."
          className="h-10 w-64 rounded-xl border-transparent bg-card pl-9 shadow-sm"
        />
      </div>
    </div>
  )
}
