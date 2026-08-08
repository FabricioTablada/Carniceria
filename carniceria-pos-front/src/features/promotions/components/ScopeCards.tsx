import { useState } from 'react'
import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Gift, Layers, Package, Search, ShoppingCart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { cn } from '@/lib/utils'
import type { Category } from '@/features/categories/types/category.types'
import type { Product } from '@/features/products/types/product.types'
import type {
  CreatePromotionDto,
  PromotionProductInput,
  PromotionScopeType,
} from '../types/promotion.types'

const SCOPE_TYPE_OPTIONS: {
  value: PromotionScopeType
  label: string
  hint: string
  icon: typeof Package
}[] = [
  {
    value: 'PRODUCT',
    label: 'Producto',
    hint: 'Aplica a productos específicos seleccionados.',
    icon: Package,
  },
  {
    value: 'CATEGORY',
    label: 'Categoría',
    hint: 'Aplica a todos los productos de una o más categorías.',
    icon: Layers,
  },
  {
    value: 'COMBO',
    label: 'Combo',
    hint: 'Aplica a un conjunto de productos, cada uno con una cantidad requerida.',
    icon: Gift,
  },
  {
    value: 'CART',
    label: 'Carrito completo',
    hint: 'Aplica al total de la venta, sin importar los productos.',
    icon: ShoppingCart,
  },
]

const checkboxClassName = cn(
  'size-4 rounded border-input',
  'focus-visible:ring-3 focus-visible:ring-ring/50',
)

interface ScopeCardsProps {
  control: Control<CreatePromotionDto>
  errors: FieldErrors<CreatePromotionDto>
  isSubmitting: boolean
  products: Product[]
  categories: Category[]
  selectedProducts: PromotionProductInput[]
  onToggleProduct: (productId: string, checked: boolean) => void
  onUpdateRequiredQuantity: (productId: string, value: string) => void
  selectedCategoryIds: string[]
  onToggleCategory: (categoryId: string, checked: boolean) => void
}

/**
 * features/promotions/components/ScopeCards.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — rediseño de Promociones, seccion "¿A qué
 * aplica?" (antes "Alcance"). Reemplaza el `<Select>` de `scopeType` por
 * 4 tarjetas seleccionables (radio nativo, sin componente nuevo) que
 * muestran el `hint` que ya existia en el codigo (definido en
 * `SCOPE_TYPE_OPTIONS` de la version anterior de `PromotionForm.tsx`)
 * pero nunca se mostraba en pantalla — mismo texto, ahora visible.
 *
 * El selector de productos/categorias se mantiene igual (checkboxes,
 * misma decision documentada de no construir un dialogo de busqueda para
 * esta entidad), pero agrega un buscador de texto (filtro 100% cliente
 * sobre la lista ya cargada por `useProducts`/`useCategories` — sin
 * pedir nada nuevo) y un contador de seleccionados siempre visible.
 *
 * Mismo contrato de datos que antes: `productIds`/`categoryIds` siguen
 * siendo estado local del formulario padre (`PromotionForm.tsx`), este
 * componente solo recibe los valores y los callbacks para modificarlos.
 */
export function ScopeCards({
  control,
  errors,
  isSubmitting,
  products,
  categories,
  selectedProducts,
  onToggleProduct,
  onUpdateRequiredQuantity,
  selectedCategoryIds,
  onToggleCategory,
}: ScopeCardsProps) {
  const [productSearch, setProductSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  )
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.trim().toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>
          Aplica a
          <RequiredMark />
        </Label>
        <Controller
          control={control}
          name="scopeType"
          render={({ field }) => (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SCOPE_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon
                const selected = field.value === option.value

                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-colors duration-150',
                      selected
                        ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                        : 'border-input hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="radio"
                      name="promotion-scope-type"
                      value={option.value}
                      checked={selected}
                      disabled={isSubmitting}
                      onChange={() => field.onChange(option.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2">
                      <Icon className={cn('size-4', selected ? 'text-brand' : 'text-muted-foreground')} />
                      <span className={cn('text-sm font-semibold', selected && 'text-brand')}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{option.hint}</p>
                  </label>
                )
              })}
            </div>
          )}
        />
        {errors.scopeType && (
          <p className="text-sm text-destructive">{errors.scopeType.message}</p>
        )}
      </div>

      <Controller
        control={control}
        name="scopeType"
        render={({ field: { value: scope } }) => (
          <>
            {(scope === 'PRODUCT' || scope === 'COMBO') && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    Productos
                    <RequiredMark />
                  </Label>
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedProducts.length} seleccionado{selectedProducts.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar producto..."
                    disabled={isSubmitting}
                    className="h-8 pl-8 text-sm"
                  />
                </div>

                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-input p-2">
                  {filteredProducts.length === 0 && (
                    <p className="px-1 py-1 text-sm text-muted-foreground">
                      {products.length === 0
                        ? 'No hay productos activos disponibles.'
                        : 'Sin resultados para esta búsqueda.'}
                    </p>
                  )}
                  {filteredProducts.map((product) => {
                    const selected = selectedProducts.find((item) => item.productId === product.id)
                    return (
                      <div
                        key={product.id}
                        className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className={checkboxClassName}
                          checked={Boolean(selected)}
                          disabled={isSubmitting}
                          onChange={(event) => onToggleProduct(product.id, event.target.checked)}
                        />
                        <span className="flex-1 text-sm">{product.name}</span>
                        {scope === 'COMBO' && selected && (
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            placeholder="Cant."
                            disabled={isSubmitting}
                            value={selected.requiredQuantity ?? ''}
                            onChange={(event) =>
                              onUpdateRequiredQuantity(product.id, event.target.value)
                            }
                            className="h-8 w-20 rounded-lg"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                {errors.productIds && (
                  <p className="text-sm text-destructive">{errors.productIds.message as string}</p>
                )}
              </div>
            )}

            {scope === 'CATEGORY' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    Categorías
                    <RequiredMark />
                  </Label>
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedCategoryIds.length} seleccionada
                    {selectedCategoryIds.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="Buscar categoría..."
                    disabled={isSubmitting}
                    className="h-8 pl-8 text-sm"
                  />
                </div>

                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-input p-2">
                  {filteredCategories.length === 0 && (
                    <p className="px-1 py-1 text-sm text-muted-foreground">
                      {categories.length === 0
                        ? 'No hay categorías activas disponibles.'
                        : 'Sin resultados para esta búsqueda.'}
                    </p>
                  )}
                  {filteredCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className={checkboxClassName}
                        checked={selectedCategoryIds.includes(category.id)}
                        disabled={isSubmitting}
                        onChange={(event) => onToggleCategory(category.id, event.target.checked)}
                      />
                      <span className="text-sm">{category.name}</span>
                    </div>
                  ))}
                </div>
                {errors.categoryIds && (
                  <p className="text-sm text-destructive">{errors.categoryIds.message as string}</p>
                )}
              </div>
            )}
          </>
        )}
      />
    </div>
  )
}
