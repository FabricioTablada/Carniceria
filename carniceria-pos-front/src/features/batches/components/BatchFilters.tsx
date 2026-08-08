import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterBar } from '@/components/common/FilterBar'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import type { BatchFilters as BatchFiltersValue, BatchStatus } from '../types/batch.types'

interface SelectOption {
  id: string
  name: string
}

interface BatchFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio, mismo
   * criterio que `InventoryWasteFilters.tsx`. */
  filters: BatchFiltersValue
  /** Opciones para el selector de producto. */
  products?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: BatchFiltersValue) => void
}

const STATUS_LABELS: Record<BatchStatus | 'all', string> = {
  all: 'Todos los estados',
  ACTIVE: 'Activo',
  DEPLETED: 'Agotado',
  EXPIRED: 'Vencido',
  BLOCKED: 'Bloqueado',
}

/**
 * features/batches/components/BatchFilters.tsx
 * -----------------------------------------------------------------------------
 * Mismo estandar visual que `InventoryWasteFilters.tsx`/`PurchaseFilters.tsx`
 * — vive dentro de `Toolbar.tsx`, sin contenedor propio.
 *
 * Sin selector de Sucursal: no existe todavia ningun modulo
 * `features/sucursales` en el frontend (mismo hallazgo ya documentado en
 * `PurchaseFilters.tsx` — sin `useBranches`/`useSucursales`, sin API).
 * `BatchFiltersValue` sigue soportando `sucursalId` a nivel de tipo; solo
 * falta ese modulo para poblarlo.
 */
export function BatchFilters({ filters, products = [], onFiltersChange }: BatchFiltersProps) {
  const { data: suppliersResponse } = useSuppliers({ active: true })
  const suppliers = suppliersResponse?.data ?? []

  return (
    <FilterBar>
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="batch-filters-product"
          className="text-xs font-semibold text-muted-foreground"
        >
          Producto
        </Label>
        <Select
          value={filters.productId ?? ''}
          onValueChange={(value: unknown) => {
            const productId = value as string

            onFiltersChange({ ...filters, productId: productId || undefined })
          }}
        >
          <SelectTrigger
            id="batch-filters-product"
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          >
            {/*
              @base-ui/react Select.Value no deriva el label de los
              Select.Item renderizados. Se resuelve manualmente, mismo
              criterio que `InventoryWasteFilters.tsx`.
            */}
            <SelectValue>
              {(value: unknown) => {
                const productId = value as string
                if (!productId) return 'Todos los productos'
                return products.find((product) => product.id === productId)?.name ?? productId
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los productos</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="batch-filters-supplier"
          className="text-xs font-semibold text-muted-foreground"
        >
          Proveedor
        </Label>
        <Select
          value={filters.supplierId ?? ''}
          onValueChange={(value: unknown) => {
            const supplierId = value as string

            onFiltersChange({ ...filters, supplierId: supplierId || undefined })
          }}
        >
          <SelectTrigger
            id="batch-filters-supplier"
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          >
            <SelectValue>
              {(value: unknown) => {
                const supplierId = value as string
                if (!supplierId) return 'Todos los proveedores'
                return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? supplierId
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los proveedores</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="batch-filters-status"
          className="text-xs font-semibold text-muted-foreground"
        >
          Estado
        </Label>
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(value: unknown) => {
            const status = value as BatchStatus | 'all'

            onFiltersChange({ ...filters, status: status === 'all' ? undefined : status })
          }}
        >
          <SelectTrigger
            id="batch-filters-status"
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          >
            <SelectValue>
              {(value: unknown) => STATUS_LABELS[value as BatchStatus | 'all'] ?? 'Todos los estados'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="ACTIVE">Activo</SelectItem>
            <SelectItem value="DEPLETED">Agotado</SelectItem>
            <SelectItem value="EXPIRED">Vencido</SelectItem>
            <SelectItem value="BLOCKED">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </FilterBar>
  )
}
