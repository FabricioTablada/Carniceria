import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import type { PurchaseFilters as PurchaseFiltersValue } from '../types/purchase.types'
import { FilterBar } from '@/components/common/FilterBar'

interface PurchaseFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: PurchaseFiltersValue
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: PurchaseFiltersValue) => void
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  DRAFT: 'Borrador',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
}

/**
 * features/purchases/components/PurchaseFilters.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos/Categorias/Impuestos/
 * Proveedores/Promociones/Inventario — ya no dibuja su propio contenedor
 * con borde ni un rotulo "Filtrar" propio, vive dentro de `Toolbar.tsx`.
 * Misma logica de filtrado (sigue consumiendo `useSuppliers` directamente,
 * sin cambios).
 */
export function PurchaseFilters({
  filters,
  onFiltersChange,
}: PurchaseFiltersProps) {
  const { data: suppliersResponse } = useSuppliers({ active: true })
  const suppliers = suppliersResponse?.data ?? []

  return (
    <FilterBar>
        {/*
          Sin selector de Sucursal: no existe todavia ningun modulo
          `features/sucursales` en el frontend (verificado: sin
          useBranches/useSucursales, sin API). Se omite ese control por
          completo en vez de mostrar un filtro que nunca tendria opciones
          para elegir. `PurchaseFiltersValue` sigue soportando
          `sucursalId` a nivel de tipo; solo falta ese modulo para poblarlo.
        */}

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="purchase-filters-status"
            className="text-xs font-semibold text-muted-foreground"
          >
            Estado
          </Label>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(value: unknown) => {
              const status = value as string

              onFiltersChange({
                ...filters,
                status:
                  status === 'all'
                    ? undefined
                    : (status as PurchaseFiltersValue['status']),
              })
            }}
          >
            <SelectTrigger id="purchase-filters-status" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados. Se resuelve manualmente con un
                mapa.
              */}
              <SelectValue>
                {(value: unknown) => STATUS_LABELS[value as string] ?? 'Todos'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="RECEIVED">Recibida</SelectItem>
              <SelectItem value="CANCELLED">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="purchase-filters-supplier"
            className="text-xs font-semibold text-muted-foreground"
          >
            Proveedor
          </Label>
          <Select
            value={filters.supplierId ?? ''}
            onValueChange={(value: unknown) => {
              const supplierId = value as string

              onFiltersChange({
                ...filters,
                supplierId: supplierId === '' ? undefined : supplierId,
              })
            }}
          >
            <SelectTrigger id="purchase-filters-supplier" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados. Se resuelve manualmente contra la
                lista de proveedores ya cargada.
              */}
              <SelectValue>
                {(value: unknown) => {
                  const supplierId = value as string
                  if (!supplierId) return 'Todos los proveedores'
                  return (
                    suppliers.find((supplier) => supplier.id === supplierId)
                      ?.name ?? supplierId
                  )
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
    </FilterBar>
  )
}