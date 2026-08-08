import { useEffect, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchInput } from '@/components/ui/SearchInput'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { InventoryFilters as InventoryFiltersValue } from '../types/inventory.types'
import { FilterBar } from '@/components/common/FilterBar'

interface SelectOption {
  id: string
  name: string
}

interface InventoryFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: InventoryFiltersValue
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de producto. */
  products?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: InventoryFiltersValue) => void
}

/**
 * features/inventory/components/InventoryFilters.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos/Categorias/Impuestos/
 * Proveedores/Promociones — ya no dibuja su propio contenedor con borde
 * ni un rotulo "Filtrar" propio, vive dentro de `Toolbar.tsx`.
 *
 * Bloque 7.29A: se agrego busqueda por texto (nombre/SKU/codigo de
 * barras del producto asociado) — el backend ya la soporta
 * (`ListInventoryQuerySchema`/`buildWhere`, `search` sobre la relacion
 * `product`). Mismo `SearchInput`/`useDebouncedValue` genericos ya
 * usados en el resto del proyecto (`SearchPickerPanel.tsx` y los
 * dialogos de busqueda), sin componente ni hook nuevo. Estado local
 * (`searchTerm`) solo para que el input responda al instante mientras
 * se tipea — el termino ya debounced es el unico que efectivamente
 * dispara `onFiltersChange` (y, con eso, la consulta al backend).
 */
export function InventoryFilters({
  filters,
  sucursales = [],
  products = [],
  onFiltersChange,
}: InventoryFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search ?? '')
  const debouncedSearchTerm = useDebouncedValue(searchTerm)

  // `lastSentSearchRef` guarda el ultimo termino que ESTE componente le
  // envio al padre — distingue "el padre cambio `filters.search` porque
  // yo lo pedi" (no hacer nada mas) de "el padre lo cambio por otra razon"
  // (ej. "Limpiar filtros" en `InventoryPage.tsx` llama a
  // `onFiltersChange({})`), caso en el que el input de texto debe
  // reflejarlo — sin esto, "Limpiar filtros" limpiaba Sucursal/Producto
  // pero dejaba el termino tipeado visible en este campo.
  const lastSentSearchRef = useRef(filters.search)
  const filtersRef = useRef(filters)
  const onFiltersChangeRef = useRef(onFiltersChange)

  useEffect(() => {
    filtersRef.current = filters
    onFiltersChangeRef.current = onFiltersChange
  }, [filters, onFiltersChange])

  // Envia el termino ya debounced al padre (dispara `GET /inventory` con
  // `search`). No depende de `filters` completo a proposito: cada cambio
  // de Sucursal/Producto ya crea un objeto `filters` nuevo, y no debe
  // reenviar el mismo termino de busqueda sin ningun cambio real.
  useEffect(() => {
    const nextSearch = debouncedSearchTerm.trim() || undefined

    if (nextSearch === lastSentSearchRef.current) {
      return
    }

    lastSentSearchRef.current = nextSearch
    onFiltersChangeRef.current({ ...filtersRef.current, search: nextSearch })
  }, [debouncedSearchTerm])

  // Sincroniza el input si `filters.search` cambia por una razon ajena a
  // este componente (ver comentario de `lastSentSearchRef` arriba).
  useEffect(() => {
    if (filters.search !== lastSentSearchRef.current) {
      lastSentSearchRef.current = filters.search
      setSearchTerm(filters.search ?? '')
    }
  }, [filters.search])

  return (
    <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="inventory-filters-search"
            className="text-xs font-semibold text-muted-foreground"
          >
            Buscar
          </Label>
          <SearchInput
            id="inventory-filters-search"
            label="Buscar por nombre, SKU o código de barras"
            placeholder="Nombre, SKU o código de barras"
            value={searchTerm}
            onChange={setSearchTerm}
            className="h-10 min-w-56 rounded-xl border-transparent bg-card shadow-sm transition-shadow duration-200 hover:shadow-md"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="inventory-filters-sucursal"
            className="text-xs font-semibold text-muted-foreground"
          >
            Sucursal
          </Label>
          <Select
            value={filters.sucursalId ?? ''}
            onValueChange={(value: unknown) => {
              const sucursalId = value as string

              onFiltersChange({
                ...filters,
                sucursalId: sucursalId || undefined,
              })
            }}
          >
            <SelectTrigger id="inventory-filters-sucursal" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados. Se resuelve manualmente buscando
                en `sucursales`.
              */}
              <SelectValue>
                {(value: unknown) => {
                  const sucursalId = value as string
                  if (!sucursalId) return 'Todas las sucursales'
                  return (
                    sucursales.find((sucursal) => sucursal.id === sucursalId)
                      ?.name ?? sucursalId
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las sucursales</SelectItem>
              {sucursales.map((sucursal) => (
                <SelectItem key={sucursal.id} value={sucursal.id}>
                  {sucursal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="inventory-filters-product"
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
            <SelectTrigger id="inventory-filters-product" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
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
    </FilterBar>
  )
}