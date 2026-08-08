import { useState } from 'react'
import { toast } from 'sonner'
import { FolderTree } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SearchPickerPanel } from '@/components/ui/SearchPickerPanel'
import { Badge } from '@/components/common/Badge'
import { resolveCategoryColor } from '@/lib/categoryColor'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCategoryLookup } from '../hooks/useCategoryLookup'
import { useCreateCategory } from '../hooks/useCreateCategory'
import { getCategoryErrorMessage } from '../utils/categoryErrors'
import { CategoryForm } from './CategoryForm'
import type { CategoryLookupItem, CreateCategoryDto } from '../types/category.types'

interface CategorySearchDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin estado propio de apertura. */
  open: boolean
  /** Se dispara cuando el dialogo pide cambiar su estado (cerrar, Escape, click afuera). */
  onOpenChange: (open: boolean) => void
  /** Se dispara cuando el usuario elige una categoria de los resultados, o
   * termina de crear una nueva desde el mismo dialogo — ambos casos usan
   * la misma salida (mismo criterio que `ProductSearchDialog.tsx`).
   * Arquitectura de selectores, Bloque 2: entrega un `CategoryLookupItem`
   * (forma liviana de `GET /categories/lookup`), ya NO el `Category`
   * completo. */
  onSelect: (category: CategoryLookupItem) => void
}

/** Traduce la `Category` completa que devuelve `useCreateCategory` a la
 * misma forma liviana que ya entregan los resultados de busqueda
 * (`CategoryLookupItem`) — mismo criterio que `ProductSearchDialog.tsx`. */
function toLookupItem(category: {
  id: string
  name: string
  description: string | null
  color: string | null
  parent: { name: string } | null
}): CategoryLookupItem {
  return {
    id: category.id,
    label: category.name,
    parentName: category.parent?.name ?? null,
    description: category.description,
    color: category.color,
  }
}

/**
 * features/categories/components/CategorySearchDialog.tsx
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 2: migrado completamente a la
 * infraestructura compartida (`useDebouncedValue`, `SearchPickerPanel`) y
 * al patron de lookup del backend (`useCategoryLookup` -> `GET
 * /categories/lookup`, no `GET /categories`). Sigue exactamente el patron
 * de `ProductSearchDialog.tsx`. Sin cambio de experiencia: la fila de
 * resultado sigue mostrando la categoria padre y la descripcion —
 * `CategoryLookupItem` (Bloque 2) se amplio especificamente para que esto
 * no se perdiera (ver `category.types.ts`).
 *
 * Segundo modo ("crear categoria"): igual que antes — reutiliza el mismo
 * `CategoryForm` de `CreateCategoryPage.tsx` y el mismo `useCreateCategory`.
 * La categoria recien creada (forma completa `Category`) se traduce a
 * `CategoryLookupItem` (`toLookupItem`) antes de entregarse por
 * `onSelect`, mismo criterio que `ProductSearchDialog.tsx`.
 */
export function CategorySearchDialog({ open, onOpenChange, onSelect }: CategorySearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm)
  const [mode, setMode] = useState<'search' | 'create'>('search')

  // Mismo patron que ProductSearchDialog.tsx: se ajusta durante el render
  // (no en un efecto) para no disparar un set-state sincrono dentro de un
  // effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setSearchTerm('')
      setMode('search')
    }
  }

  const { data, isLoading, isError, error } = useCategoryLookup({
    active: true,
    search: debouncedSearchTerm || undefined,
  })

  const categories = data?.data ?? []

  // Categorias activas para el selector de "categoria padre" del
  // `CategoryForm` embebido — mismo criterio que `CreateCategoryPage.tsx`.
  // Sigue usando el listado de tabla (no el lookup): necesita el catalogo
  // completo de opciones para un `<Select>`, no una busqueda acotada.
  const { data: parentCategoriesResponse } = useCategoryLookup({ active: true })
  const parentCategoryOptions = (parentCategoriesResponse?.data ?? []).map((category) => ({
    id: category.id,
    name: category.label,
  }))

  const {
    mutate: createCategory,
    isPending: isCreatingCategory,
    isError: isCreateCategoryError,
    error: createCategoryError,
  } = useCreateCategory()

  const handleCreateCategory = (values: CreateCategoryDto) => {
    createCategory(values, {
      onSuccess: (category) => {
        toast.success('Categoría creada correctamente.')
        onSelect(toLookupItem(category))
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[640px] w-[90vw] max-w-2xl flex-col gap-0 p-0">
        {mode === 'search' ? (
          <SearchPickerPanel
            title="Buscar categoría"
            description="Busca por nombre para asignarla al producto."
            searchInputId="category-search"
            searchLabel="Buscar categoría"
            searchPlaceholder="Nombre de la categoría"
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            createLabel="Crear categoría"
            onCreateNew={() => setMode('create')}
            isLoading={isLoading}
            isError={isError}
            errorMessage={error?.message ?? 'Ocurrió un error al buscar categorías.'}
            loadingMessage="Buscando categorías..."
            emptyMessage="No se encontraron categorías."
            items={categories}
            getItemKey={(category) => category.id}
            renderItem={(category) => {
              const color = resolveCategoryColor(category)

              return (
              <button
                type="button"
                onClick={() => onSelect(category)}
                className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full"
                  style={{ ...color.tint, ...color.text }}
                >
                  <FolderTree className="size-5" />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-base font-semibold text-foreground">
                    {category.label}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {category.parentName && <Badge variant="muted">{category.parentName}</Badge>}
                    {category.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {category.description}
                      </span>
                    )}
                  </span>
                </span>
              </button>
              )
            }}
          />
        ) : (
          <>
            <div className="border-b p-5">
              <DialogHeader>
                <DialogTitle>Nueva categoría</DialogTitle>
                <DialogDescription>
                  Se asignará al producto automáticamente al guardarla.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {isCreateCategoryError && (
                <ErrorAlert>{getCategoryErrorMessage(createCategoryError)}</ErrorAlert>
              )}

              <CategoryForm
                mode="create"
                categories={parentCategoryOptions}
                isSubmitting={isCreatingCategory}
                onSubmit={handleCreateCategory}
                onCancel={() => setMode('search')}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
