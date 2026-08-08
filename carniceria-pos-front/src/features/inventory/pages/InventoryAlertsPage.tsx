import { useState } from 'react'
import { Download, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { exportToCsv } from '@/utils/exportToCsv'
import { formatQuantity } from '@/utils/formatQuantity'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { useLowStock } from '@/features/reports/hooks/useLowStock'
import { LowStockTable } from '@/features/reports/components/LowStockTable'
import { LowStockTableSkeleton } from '@/features/reports/components/LowStockTableSkeleton'
import { LowStockKpiRow } from '@/features/reports/components/LowStockKpiRow'
import { LowStockFilters } from '@/features/reports/components/LowStockFilters'
import { InventoryWorkspaceTabs } from '../components/InventoryWorkspaceTabs'
import type { LowStockFilters as LowStockFiltersValue } from '@/features/reports/types/report.types'

/**
 * features/inventory/pages/InventoryAlertsPage.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Inventario — pestaña "Alertas de stock" del workspace
 * unificado. Reutiliza EXACTAMENTE los mismos componentes/hook ya
 * construidos para `LowStockPage.tsx` (`features/reports`) — `useLowStock`,
 * `LowStockKpiRow`, `LowStockTable`, `LowStockFilters` — sin ninguna
 * consulta ni cálculo nuevo. La única diferencia con `LowStockPage.tsx` es
 * el encabezado (breadcrumb bajo Inventario, `InventoryWorkspaceTabs` en
 * vez de vivir exclusivamente en Reportes) — misma pantalla, ahora también
 * accesible desde el módulo al que realmente le importa.
 */
export function InventoryAlertsPage() {
  const [filters, setFilters] = useState<LowStockFiltersValue>({})
  const { data, isLoading, isFetching, isError, error } = useLowStock(filters)
  const items = data ?? []

  const { data: categoriesResponse } = useCategories({ active: true })
  const categories = (categoriesResponse?.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
  }))

  const handleExport = () => {
    exportToCsv(
      items,
      [
        { header: 'Producto', value: (item) => item.productName },
        { header: 'SKU', value: (item) => item.sku ?? '' },
        { header: 'Categoría', value: (item) => item.categoryName ?? '' },
        { header: 'Sucursal', value: (item) => item.sucursalName },
        { header: 'Cantidad', value: (item) => formatQuantity(item.quantity, item.unitOfMeasure) },
        { header: 'Punto de reorden', value: (item) => item.reorderPoint ?? '' },
        { header: 'Punto de corte usado', value: (item) => item.thresholdUsed ?? '' },
      ],
      'alertas-de-stock.csv',
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Inventario', href: '/inventory' },
          { label: 'Alertas de stock' },
        ]}
        title="Inventario"
        description="Productos cuya existencia está en o por debajo de su punto de reorden."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={!items.length}
            className="h-10 gap-2 rounded-xl"
          >
            <Download className="size-4" />
            Exportar
          </Button>
        }
      />

      <InventoryWorkspaceTabs />

      <LowStockKpiRow items={items} isLoading={isLoading} />

      <Toolbar
        filters={<LowStockFilters filters={filters} categories={categories} onFiltersChange={setFilters} />}
      />

      {isLoading && <LowStockTableSkeleton />}

      {isError && <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>}

      {!isLoading && !isError && (
        <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
          <LowStockTable
            items={items}
            emptyMessage={
              <EmptyState
                icon={TriangleAlert}
                title="No hay productos con bajo inventario"
                description="No se encontraron productos que coincidan con los filtros seleccionados."
              />
            }
          />
        </div>
      )}
    </div>
  )
}
