import {
  CheckCircle2,
  CircleDashed,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { useWasteReport } from '@/features/reports/hooks/useWasteReport'
import type {
  WasteReportByProductItem,
  WasteReportFilters,
} from '@/features/reports/types/report.types'

interface InventoryWasteAnalysisProps {
  filters: WasteReportFilters
}

/** Pulido "dashboard ejecutivo" (aprobado): clasificación puramente de
 * PRESENTACIÓN sobre `variancePercent`, que el backend ya calcula — no es
 * un cálculo nuevo, es un umbral de lectura (¿cuántos puntos porcentuales
 * cuentan como "dentro del rango" en vez de exigir una igualdad exacta,
 * que casi nunca ocurre en datos reales?). 1pp de tolerancia. */
const IN_RANGE_TOLERANCE_POINTS = 1
/** Umbral de "producto crítico" (aprobado, "variación significativamente
 * superior") — mismo criterio de arriba: lectura sobre `variancePercent`
 * ya calculado, no una regla de negocio nueva ni un cambio de cálculo. */
const CRITICAL_VARIANCE_POINTS = 3
/** "Muestra pequeña" (aprobado, "solo si la información disponible lo
 * permite"): `count` (cantidad de registros de merma del producto en el
 * período) ya viene en `WasteReportByProductItem` — con menos de 3
 * registros, cualquier % es estadísticamente poco representativo. Umbral
 * de presentación, no un cálculo ni una regla de backend nueva. */
const SMALL_SAMPLE_COUNT_THRESHOLD = 3

type ComparisonStatus = 'no-data' | 'in-range' | 'above' | 'below'

function resolveStatus(row: WasteReportByProductItem): ComparisonStatus {
  if (row.variancePercent === null) return 'no-data'
  if (row.variancePercent > IN_RANGE_TOLERANCE_POINTS) return 'above'
  if (row.variancePercent < -IN_RANGE_TOLERANCE_POINTS) return 'below'
  return 'in-range'
}

const STATUS_CONFIG: Record<
  ComparisonStatus,
  { label: string; icon: typeof CheckCircle2; text: string; tint: string }
> = {
  // Pulido "Análisis de mermas" (aprobado): "Sin historial de compras" en
  // vez de "Sin datos suficientes" — nombra la causa real (no hay compras
  // registradas para el producto), no una falta de datos genérica. Ver
  // `NO_DATA_EXPLANATION` para la frase explicativa que acompaña al chip.
  'no-data': { label: 'Sin historial de compras', icon: CircleDashed, text: 'text-muted-foreground', tint: 'bg-muted' },
  'in-range': { label: 'Dentro del rango', icon: CheckCircle2, text: 'text-success', tint: 'bg-success/10' },
  above: { label: 'Superior a la esperada', icon: TrendingUp, text: 'text-destructive', tint: 'bg-destructive/10' },
  below: { label: 'Inferior a la esperada', icon: TrendingDown, text: 'text-accent-teal', tint: 'bg-accent-teal/10' },
}

/** Pulido "Análisis de mermas" (aprobado): frase que acompaña al chip
 * "Sin historial de compras" — explica la causa real (confirmada contra
 * `reports.repository.ts::getWasteReportByProduct`: `purchasedQuantity`
 * solo cuenta `PurchaseItem` de compras `RECEIVED`) en vez de dejar que
 * el usuario adivine por qué no hay comparación. Constante de UI, no
 * altera qué fila entra en este estado (eso lo sigue decidiendo
 * `resolveStatus` sobre `variancePercent`, ya calculado por el backend). */
const NO_DATA_EXPLANATION =
  'No es posible calcular la merma real porque este producto aún no posee compras registradas.'

function StatusChip({ status }: { status: ComparisonStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        config.tint,
        config.text,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {config.label}
    </span>
  )
}

/**
 * features/inventory/components/InventoryWasteAnalysis.tsx
 * -----------------------------------------------------------------------------
 * Pulido "dashboard ejecutivo" (aprobado): sigue siendo la sub-vista
 * "Análisis" de Mermas sobre `GET /reports/waste` (`useWasteReport`) — CERO
 * cálculos nuevos, CERO endpoints nuevos. Todo lo que se agrega es lectura
 * y jerarquía visual sobre campos que `WasteReportByProductItem` YA
 * expone (`variancePercent`, `realWastePercent`, `expectedWastePercent`,
 * `totalValue`, `count`):
 *
 *  - Orden por defecto: `totalValue` descendente — el producto que más
 *    pierde en plata queda primero, respondiendo "¿quién pierde más?" sin
 *    que el usuario tenga que buscarlo.
 *  - `StatusChip`: la comparación deja de ser solo un número — "Dentro
 *    del rango"/"Superior a la esperada"/"Inferior a la esperada"/"Sin
 *    historial de compras", con ícono y color (ver `STATUS_CONFIG`).
 *  - Valor económico como protagonista de cada fila (cifra grande, a la
 *    derecha, con su propio color de énfasis) — antes era la columna más
 *    chica y gris.
 *  - Fila "crítica" (`variancePercent > 3pp`): franja lateral roja + fondo
 *    tenue — resalta sin agregar un chip redundante al de arriba.
 *  - Caso `purchasedQuantity = 0` (`variancePercent === null`): se
 *    mantiene exactamente honesto — nunca se inventa un %. Pulido
 *    "Análisis de mermas" (aprobado): el chip pasó de "Sin datos
 *    suficientes" a "Sin historial de compras" + `NO_DATA_EXPLANATION`
 *    junto al nombre del producto — nombra la causa real (confirmada
 *    contra el repositorio: sin `PurchaseItem` de compras `RECEIVED` para
 *    ese producto) en vez de dejar que el usuario adivine. Mismo dato,
 *    solo presentación más clara.
 *  - "Muestra pequeña" (`count < 3`): chip de advertencia aparte, solo
 *    cuando SÍ hay comparación (no tiene sentido superponerlo a "Sin
 *    historial de compras", que ya es la advertencia más fuerte).
 *  - Resumen superior (conteo por estado): mismo `resolveStatus` ya
 *    calculado para las filas, solo tabulado — responde "¿cuántos están
 *    normales?" de un vistazo, sin otra fuente de datos.
 *
 * Explícitamente NO incluido en este bloque (aprobado para fase
 * posterior): tendencias mensuales, múltiples llamadas/`groupBy`,
 * snapshot histórico de `expectedWastePercent`, `batchId`.
 *
 * Preparado para una evolución futura (aprobado, "sin implementar
 * lógica todavía"): la recomendación inteligente que compare
 * `expectedWastePercent` configurado contra el comportamiento histórico
 * consistente y sugiera actualizarlo NO está implementada acá — pero
 * `resolveStatus`/`STATUS_CONFIG` ya son el punto de extensión natural:
 * cuando exista historial multi-período (`groupBy` de la fase de
 * "Tendencias", explícitamente fuera de este bloque), esa fase futura
 * solo necesita una función adicional del mismo tipo que `resolveStatus`
 * (ej. `resolveRecommendation(rows: WasteReportByProductItem[]): ...`)
 * que lea `variancePercent`/`count` de varios períodos consecutivos y
 * decida si la desviación es "consistente" — sin tocar el cálculo de
 * `variancePercent` en sí (eso sigue siendo 100% responsabilidad del
 * backend). Nunca debe modificar `Product.expectedWastePercent`
 * automáticamente: la recomendación futura es, por diseño, una sugerencia
 * que el usuario acepta o descarta manualmente — igual criterio que el
 * resto del ERP (ningún flujo de este proyecto escribe datos sin una
 * acción explícita del usuario).
 */
export function InventoryWasteAnalysis({ filters }: InventoryWasteAnalysisProps) {
  const { data: report, isLoading } = useWasteReport(filters)

  const rows = [...(report?.byProduct ?? [])].sort((a, b) => b.totalValue - a.totalValue)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={TriangleAlert}
          title="Sin datos suficientes para el análisis"
          description="Se necesitan mermas y compras registradas en el período filtrado para comparar merma real contra la esperada."
        />
      </div>
    )
  }

  const statusTally = rows.reduce(
    (tally, row) => {
      tally[resolveStatus(row)] += 1
      return tally
    },
    { 'no-data': 0, 'in-range': 0, above: 0, below: 0 } as Record<ComparisonStatus, number>,
  )

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/70 px-4 py-3 text-xs text-muted-foreground">
        {(['above', 'in-range', 'below', 'no-data'] as ComparisonStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', STATUS_CONFIG[status].tint.replace('/10', ''))} />
            {statusTally[status]} {STATUS_CONFIG[status].label.toLowerCase()}
          </span>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-border/70">
        {rows.map((row) => {
          const status = resolveStatus(row)
          const hasComparison = row.variancePercent !== null && row.realWastePercent !== null
          const isCritical = row.variancePercent !== null && row.variancePercent > CRITICAL_VARIANCE_POINTS
          const isSmallSample = hasComparison && row.count < SMALL_SAMPLE_COUNT_THRESHOLD

          return (
            <div
              key={row.productId}
              className={cn(
                'flex flex-col gap-2.5 border-l-4 border-l-transparent px-4 py-3 sm:flex-row sm:items-center sm:gap-4',
                isCritical && 'border-l-destructive bg-destructive/5',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-semibold text-foreground', isCritical && 'text-destructive')}>
                  {row.productName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.quantity} unid. mermadas · {row.count} {row.count === 1 ? 'registro' : 'registros'}
                </p>
                {status === 'no-data' && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{NO_DATA_EXPLANATION}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <StatusChip status={status} />
                {isSmallSample && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-amber/10 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-accent-amber">
                    <TriangleAlert className="size-3.5 shrink-0" />
                    Muestra pequeña
                  </span>
                )}
              </div>

              <div className="text-xs text-muted-foreground tabular-nums sm:w-44 sm:shrink-0 sm:text-right">
                {hasComparison ? (
                  <>
                    <span className={cn('font-semibold', STATUS_CONFIG[status].text)}>
                      {row.realWastePercent?.toFixed(1)}%
                    </span>{' '}
                    real vs {row.expectedWastePercent.toFixed(1)}% esp.
                  </>
                ) : (
                  // Pulido "Análisis de mermas" (aprobado): la explicación
                  // ya se muestra junto al nombre del producto
                  // (`NO_DATA_EXPLANATION`) — acá solo un guion neutro,
                  // sin repetir el mensaje dos veces en la misma fila.
                  '—'
                )}
              </div>

              <div className="text-right sm:w-32 sm:shrink-0">
                <p className={cn('text-lg leading-none font-bold tabular-nums', isCritical ? 'text-destructive' : 'text-foreground')}>
                  {formatCurrency(row.totalValue)}
                </p>
                <p className="text-[0.6875rem] text-muted-foreground">perdido</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
