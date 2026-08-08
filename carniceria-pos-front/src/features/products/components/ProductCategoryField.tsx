import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { cn } from '@/lib/utils'
import { resolveCategoryColor } from '@/lib/categoryColor'
import { useCategory } from '@/features/categories/hooks/useCategory'
import { CategorySearchDialog } from '@/features/categories/components/CategorySearchDialog'
import type { CategoryLookupItem } from '@/features/categories/types/category.types'

interface ProductCategoryFieldProps {
  /** id del `categoryId` seleccionado (o `''` si ninguno). Componente
   * controlado, sin estado propio de seleccion — el padre (`ProductForm`/
   * `QuickProductForm`, vía `Controller`) es quien guarda el valor real. */
  value: string
  /** Se dispara con el nuevo `categoryId` al elegir una categoria. */
  onChange: (categoryId: string) => void
  /** Mensaje de error de validacion (`errors.categoryId?.message`). */
  error?: string
  disabled?: boolean
}

/**
 * features/products/components/ProductCategoryField.tsx
 * -----------------------------------------------------------------------------
 * Reemplaza el `Select` con el catalogo completo de categorias (que no
 * escala) por un boton que abre `CategorySearchDialog.tsx` — buscar antes
 * de elegir, mismo criterio ya aplicado a productos en
 * `ProductSearchDialog.tsx`. Extraido de `ProductForm.tsx` para que tanto
 * el formulario completo (`ProductForm`, paginas propias) como el rapido
 * (`QuickProductForm`, dentro de Compras) compartan un unico lugar donde
 * vive esta logica — un cambio futuro al selector de categoria se hace
 * una sola vez, no dos.
 *
 * Resuelve el nombre de la categoria ya seleccionada por id directo
 * (`useCategory`, `GET /categories/:id`), no contra una lista separada
 * que podria no contenerla (por paginacion o por no compartir el mismo
 * filtro) — la misma causa raiz que ya se corrigio una vez en
 * `PurchaseItemsField.tsx` (dos fuentes de datos independientes que
 * pueden desincronizarse). Esto tambien es lo que permite que este campo
 * ya no necesite recibir la lista completa de categorias como prop (a
 * diferencia del `Select` anterior) — util para precargar el nombre en
 * modo edicion (`EditProductPage.tsx`) sin depender de que esa categoria
 * este en la primera pagina de `useCategories`.
 */
export function ProductCategoryField({
  value,
  onChange,
  error,
  disabled = false,
}: ProductCategoryFieldProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // Arquitectura de selectores, Bloque 2: `CategorySearchDialog` ahora
  // entrega un `CategoryLookupItem` (`{id,label,...}`), no la `Category`
  // completa — se guarda solo `{id,name}` (lo unico que este campo
  // necesita mostrar), tomando `name` de `category.label`. Estructuralmente
  // compatible con `resolvedCategory` (sigue siendo `Category` completa,
  // via `useCategory`/`GET /categories/:id`, sin cambios): ambas formas
  // tienen `.name`, por eso `displayCategory?.name` mas abajo sigue
  // compilando sin cambios.
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string
    name: string
    color: string | null
  } | null>(null)

  const needsResolveById = Boolean(value) && selectedCategory?.id !== value
  const { data: resolvedCategory } = useCategory(needsResolveById ? value : '')

  const displayCategory = selectedCategory?.id === value ? selectedCategory : resolvedCategory
  const displayColor = displayCategory
    ? resolveCategoryColor({ id: displayCategory.id, color: displayCategory.color })
    : null

  const handleSelect = (category: CategoryLookupItem) => {
    setSelectedCategory({ id: category.id, name: category.label, color: category.color })
    onChange(category.id)
    setIsDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="product-form-categoryId">
        Categoría
        <RequiredMark />
      </Label>
      <Button
        id="product-form-categoryId"
        type="button"
        variant="outline"
        disabled={disabled}
        aria-invalid={!!error}
        onClick={() => setIsDialogOpen(true)}
        className="w-full justify-between font-normal"
      >
        <span className={cn('flex min-w-0 items-center gap-2', !displayCategory && 'text-muted-foreground')}>
          {displayColor && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={displayColor.dot}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{displayCategory?.name ?? 'Selecciona una categoría'}</span>
        </span>
        <Search className="size-4 shrink-0 text-muted-foreground" />
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <CategorySearchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSelect={handleSelect}
      />
    </div>
  )
}
