import { CalendarClock, Layers3, Lock, PackageCheck, PackageX } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useBatchesReport } from '@/features/reports/hooks/useBatchesReport'
import type { BatchStatus } from '../types/batch.types'

interface BatchesKpiRowProps {
  /** Filtro "Estado" actualmente activo en `BatchesPage.tsx` — determina
   * qué celda se muestra en estado "presionado". `undefined` = todos. */
  activeStatus: BatchStatus | undefined
  /** Aplica (o quita) el filtro "Estado" — mismo `handleFiltersChange`
   * que ya usa `BatchFilters`, sin lógica de filtrado nueva. */
  onSelectStatus: (status: BatchStatus | undefined) => void
}

function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

/**
 * features/batches/components/BatchesKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Centro de Control de Inventario (aprobado): pasa de una grilla de
 * `KpiCard` individuales (aproximando "próximos a vencer" contando la
 * ventana de 100 lotes ya cargada) a la MISMA franja `bare`/`xs` clicable
 * dividida por `divide-x` ya usada en Proveedores/Productos/Categorías/
 * Impuestos — y a datos EXACTOS: `GET /reports/batches` (`useBatchesReport`,
 * endpoint ya construido, hasta ahora sin consumir) devuelve el conteo
 * real por estado y de "próximos a vencer", sin aproximar sobre una
 * página.
 *
 * "Próximos a vencer" no es un `BatchStatus` real — no hay un filtro de
 * backend para "solo los que vencen pronto", así que al hacer click se
 * filtra por `status: 'ACTIVE'` (los únicos lotes que pueden vencer) y se
 * apoya en el orden por defecto de `BatchesTable.tsx` (`Días restantes`
 * ascendente) para que aparezcan primero — mismo criterio honesto que el
 * resto del wireframe aprobado (sin inventar un filtro que no existe).
 */
export function BatchesKpiRow({ activeStatus, onSelectStatus }: BatchesKpiRowProps) {
  const { data: report, isLoading } = useBatchesReport({})

  const countFor = (status: BatchStatus) =>
    report?.byStatus.find((entry) => entry.status === status)?.count ?? 0

  const activeCount = countFor('ACTIVE')
  const depletedCount = countFor('DEPLETED')
  const blockedCount = countFor('BLOCKED')
  const expiringSoonCount = report?.expiringSoonCount ?? 0

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-5 sm:divide-y-0">
      <button
        type="button"
        onClick={() => onSelectStatus(undefined)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === undefined && 'bg-brand/5 shadow-[inset_0_-2px_0_var(--brand)]',
        )}
      >
        <KpiCard
          bare
          label="Total de lotes"
          value={isLoading ? <KpiValueSkeleton /> : (report?.totalBatches ?? '—')}
          icon={Layers3}
          size="xs"
        />
      </button>
      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === 'ACTIVE' ? undefined : 'ACTIVE')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === 'ACTIVE' && 'bg-success/5 shadow-[inset_0_-2px_0_var(--success)]',
        )}
      >
        <KpiCard bare label="Activos" value={isLoading ? <KpiValueSkeleton /> : activeCount} icon={PackageCheck} size="xs" tone="success" />
      </button>
      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === 'ACTIVE' ? undefined : 'ACTIVE')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === 'ACTIVE' && expiringSoonCount > 0 && 'bg-destructive/5 shadow-[inset_0_-2px_0_var(--destructive)]',
        )}
      >
        <KpiCard
          bare
          label="Vencen ≤7 días"
          value={isLoading ? <KpiValueSkeleton /> : expiringSoonCount}
          icon={CalendarClock}
          size="xs"
          tone={expiringSoonCount > 0 ? 'muted' : 'success'}
        />
      </button>
      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === 'BLOCKED' ? undefined : 'BLOCKED')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === 'BLOCKED' && 'bg-destructive/5 shadow-[inset_0_-2px_0_var(--destructive)]',
        )}
      >
        <KpiCard bare label="Bloqueados" value={isLoading ? <KpiValueSkeleton /> : blockedCount} icon={Lock} size="xs" tone={blockedCount > 0 ? 'muted' : 'success'} />
      </button>
      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === 'DEPLETED' ? undefined : 'DEPLETED')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStatus === 'DEPLETED' && 'bg-muted shadow-[inset_0_-2px_0_var(--muted-foreground)]',
        )}
      >
        <KpiCard bare label="Agotados" value={isLoading ? <KpiValueSkeleton /> : depletedCount} icon={PackageX} size="xs" tone="muted" />
      </button>
    </div>
  )
}
