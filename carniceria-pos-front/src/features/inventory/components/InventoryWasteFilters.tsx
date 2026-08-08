import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterBar } from '@/components/common/FilterBar'
import { WASTE_REASON_OPTIONS } from '../constants/wasteReason.constants'
import type { ListInventoryWasteFilters, WasteReason } from '../types/inventory.types'

interface SelectOption {
  id: string
  name: string
}

interface InventoryWasteFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio, mismo
   * criterio que `InventoryFilters.tsx`. */
  filters: ListInventoryWasteFilters
  /** Opciones para el selector de producto. */
  products?: SelectOption[]
  /** Opciones para el selector de usuario. */
  users?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: ListInventoryWasteFilters) => void
}

/**
 * features/inventory/components/InventoryWasteFilters.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual del sprint — ya no dibuja su propio
 * contenedor con borde ni un rotulo "Filtrar" propio, vive dentro de
 * `Toolbar.tsx`. Mismos 3 campos, misma logica de filtrado.
 */
export function InventoryWasteFilters({
  filters,
  products = [],
  users = [],
  onFiltersChange,
}: InventoryWasteFiltersProps) {
  return (
    <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="inventory-waste-filters-product"
            className="text-xs font-semibold text-muted-foreground"
          >
            Producto
          </Label>
          <Select
            value={filters.productId ?? ''}
            onValueChange={(value: unknown) => {
              const productId = value as string

              onFiltersChange({
                ...filters,
                productId: productId || undefined,
              })
            }}
          >
            <SelectTrigger id="inventory-waste-filters-product" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados. Se resuelve manualmente buscando
                en `products`, mismo criterio que `InventoryFilters.tsx`.
              */}
              <SelectValue>
                {(value: unknown) => {
                  const productId = value as string
                  if (!productId) return 'Todos los productos'
                  return (
                    products.find((product) => product.id === productId)
                      ?.name ?? productId
                  )
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
            htmlFor="inventory-waste-filters-user"
            className="text-xs font-semibold text-muted-foreground"
          >
            Usuario
          </Label>
          <Select
            value={filters.userId ?? ''}
            onValueChange={(value: unknown) => {
              const userId = value as string

              onFiltersChange({
                ...filters,
                userId: userId || undefined,
              })
            }}
          >
            <SelectTrigger id="inventory-waste-filters-user" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              <SelectValue>
                {(value: unknown) => {
                  const userId = value as string
                  if (!userId) return 'Todos los usuarios'
                  return (
                    users.find((user) => user.id === userId)?.name ?? userId
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los usuarios</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="inventory-waste-filters-reason"
            className="text-xs font-semibold text-muted-foreground"
          >
            Motivo
          </Label>
          <Select
            value={filters.reason ?? ''}
            onValueChange={(value: unknown) => {
              const reason = value as WasteReason | ''

              onFiltersChange({
                ...filters,
                reason: reason || undefined,
              })
            }}
          >
            <SelectTrigger id="inventory-waste-filters-reason" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              <SelectValue>
                {(value: unknown) => {
                  const reason = value as WasteReason | ''
                  if (!reason) return 'Todos los motivos'
                  return (
                    WASTE_REASON_OPTIONS.find((option) => option.value === reason)
                      ?.label ?? reason
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los motivos</SelectItem>
              {WASTE_REASON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
    </FilterBar>
  )
}
