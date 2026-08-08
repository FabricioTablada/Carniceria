import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'

interface ProfitReportTableSkeletonProps {
  /** Filas placeholder a mostrar. @default 8 */
  rows?: number
  /** Centro de Análisis (aprobado): sin borde/sombra/rounded propios para
   * embeberse dentro del Canvas Workspace único. `false` por defecto. */
  bare?: boolean
}

/** `ProfitReportTable.tsx` tiene 15 columnas (Documento/Fecha/Producto/SKU/
 * Cantidad/Costo unitario/Costo efectivo/Precio unitario/Descuento/
 * Subtotal/Impuesto/Total/Costo total/Utilidad/Margen) — la tabla mas
 * densa del modulo. En vez de escribir 15 anchos a mano (poco legible y
 * fragil ante cualquier cambio de columna), se genera la fila con un
 * `Array.from` — mismo `Skeleton` de siempre, solo el trazado difiere del
 * resto de los skeletons de Reportes por la cantidad de columnas real. */
const COLUMN_COUNT = 15

/**
 * features/reports/components/ProfitReportTableSkeleton.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02: mismo patron (`rounded-xl border bg-card shadow-sm`,
 * `Skeleton` de `components/common/`) que el resto de los skeletons de
 * Reportes, adaptado a la tabla mas ancha del modulo.
 */
export function ProfitReportTableSkeleton({ rows = 8, bare = false }: ProfitReportTableSkeletonProps) {
  return (
    <div className={cn('overflow-x-auto', !bare && 'rounded-xl border border-border/60 bg-card shadow-sm')}>
      <div className="flex min-w-max items-center gap-4 border-b bg-muted/50 px-4 py-3">
        {Array.from({ length: COLUMN_COUNT }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-14 shrink-0" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex min-w-max items-center gap-4 border-b px-4 py-4 last:border-b-0"
        >
          {Array.from({ length: COLUMN_COUNT }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-14 shrink-0" />
          ))}
        </div>
      ))}
    </div>
  )
}
