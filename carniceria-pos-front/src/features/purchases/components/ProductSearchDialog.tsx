import { useState } from 'react'
import { toast } from 'sonner'
import { Check, PackagePlus, PackageSearch } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SearchPickerPanel } from '@/components/ui/SearchPickerPanel'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/common/Badge'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useProductLookup } from '@/features/products/hooks/useProductLookup'
import { useCreateProduct } from '@/features/products/hooks/useCreateProduct'
import { useTaxLookup } from '@/features/taxes/hooks/useTaxLookup'
import { QuickProductForm } from '@/features/products/components/QuickProductForm'
import { getProductErrorMessage } from '@/features/products/utils/productErrors'
import type { CreateProductDto, ProductLookupItem, UnitOfMeasure } from '@/features/products/types/product.types'

interface ProductSearchDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin estado propio de apertura. */
  open: boolean
  /** Se dispara cuando el dialogo pide cambiar su estado (cerrar, Escape, click afuera). */
  onOpenChange: (open: boolean) => void
  /** Se dispara cuando el usuario elige un producto de los resultados, o
   * termina de crear uno nuevo desde el mismo dialogo — ambos casos usan
   * la misma salida, para que quien use este componente (`PurchaseItemsField.tsx`)
   * no necesite dos caminos distintos para "agregar producto a la compra".
   * Arquitectura de selectores, Bloque 2: entrega un `ProductLookupItem`
   * (forma liviana de `GET /products/lookup`), ya NO el `Product` completo
   * de `GET /products` — al crear un producto nuevo, el `Product` que
   * devuelve `useCreateProduct` se traduce a esa misma forma (ver
   * `toLookupItem` abajo) para que quien consuma `onSelect` reciba siempre
   * la misma forma sin importar el camino. Ignorado cuando
   * `selectionMode === 'multiple'` (ver `onSelectMany`). */
  onSelect: (product: ProductLookupItem) => void
  /** Mejora UX "Nueva compra" (agregar varios productos de una vez).
   * `'single'` (por defecto) es el comportamiento de siempre: elegir un
   * resultado llama a `onSelect` y cierra el dialogo. `'multiple'` deja
   * tildar varios resultados y confirmarlos juntos con `onSelectMany` —
   * no cambia la busqueda ni la logica de cada linea, solo permite
   * agregar varias de una vez. */
  selectionMode?: 'single' | 'multiple'
  /** Requerido cuando `selectionMode === 'multiple'`. Recibe todos los
   * productos tildados al confirmar, en el orden en que se tildaron. */
  onSelectMany?: (products: ProductLookupItem[]) => void
  /** Rediseño de Compras: acción rápida "Crear producto" abre este mismo
   * dialogo directo en modo creación, sin pasar primero por la búsqueda —
   * aditivo, por defecto `'search'` (comportamiento de siempre). */
  initialMode?: 'search' | 'create'
}

const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  UNIT: 'unidad',
  KILOGRAM: 'kg',
}

/** Traduce el `Product` completo que devuelve `useCreateProduct` a la
 * misma forma liviana que ya entregan los resultados de busqueda
 * (`ProductLookupItem`) — unico punto donde este archivo conoce el
 * recurso completo, precisamente para no tener que exponerlo mas alla. */
function toLookupItem(product: {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  cost: number
  category: { name: string }
  taxId: string
  tax: { name: string; rate: number }
  unitOfMeasure: UnitOfMeasure
  expectedWastePercent: number
  requiresBatch: boolean
}): ProductLookupItem {
  return {
    id: product.id,
    label: product.name,
    sku: product.sku,
    thumbnail: product.imageUrl,
    price: product.cost,
    categoryName: product.category.name,
    taxId: product.taxId,
    taxName: product.tax.name,
    taxRate: product.tax.rate,
    unitOfMeasure: product.unitOfMeasure,
    expectedWastePercent: product.expectedWastePercent,
    requiresBatch: product.requiresBatch,
  }
}

/**
 * features/purchases/components/ProductSearchDialog.tsx
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 2: migrado a la infraestructura
 * compartida (`useDebouncedValue`, `SearchPickerPanel`) y al patron de
 * lookup del backend (`useProductLookup` -> `GET /products/lookup`, no
 * `GET /products` — ver analisis y Bloque 1 aprobados). Sin cambio de
 * experiencia: la fila de resultado sigue mostrando miniatura, SKU,
 * categoria, impuesto y precio — `ProductLookupItem` (Bloque 2) se amplio
 * especificamente para que esto no se perdiera (ver `product.types.ts`).
 *
 * Instancia unica, compartida por `PurchaseItemsField.tsx` tanto para
 * "agregar linea nueva" como para "cambiar el producto de una linea
 * existente" — sin cambios en ese comportamiento.
 *
 * Segundo modo ("crear producto"): igual que antes — `QuickProductForm`
 * embebido, mismo `useCreateProduct`. El producto recien creado (forma
 * completa `Product`) se traduce a `ProductLookupItem` (`toLookupItem`)
 * antes de entregarse por `onSelect`, para que el contrato de salida de
 * este dialogo sea siempre el mismo sin importar el camino.
 *
 * Mejora UX "Nueva compra" (agregar varios productos): `selectionMode`
 * ('single' por defecto) no cambia la busqueda ni el modo "crear
 * producto" — solo cambia que pasa al elegir un resultado en modo
 * busqueda. En 'multiple', cada click tilda/destilda el resultado en vez
 * de cerrar el dialogo, y aparece una barra fija (`footer` de
 * `SearchPickerPanel`) para confirmar todos los tildados de una vez via
 * `onSelectMany`. La logica de cada linea de compra no cambia — quien
 * llama a `onSelectMany` (`PurchaseItemsField.tsx`) simplemente agrega
 * varias lineas en vez de una.
 */
export function ProductSearchDialog({
  open,
  onOpenChange,
  onSelect,
  selectionMode = 'single',
  onSelectMany,
  initialMode = 'search',
}: ProductSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm)
  const [mode, setMode] = useState<'search' | 'create'>(initialMode)
  const [selectedProducts, setSelectedProducts] = useState<ProductLookupItem[]>([])
  const isMultiple = selectionMode === 'multiple'

  // Cada vez que el dialogo ABRE (no al cerrar), arranca en `initialMode`
  // (por defecto busqueda en blanco) y sin nada tildado — necesario porque
  // esta MISMA instancia se reutiliza para distintas acciones rapidas con
  // distinto `initialMode` ("Agregar producto" vs. "Crear producto",
  // `PurchaseItemsWorkspace.tsx`), no solo al montar el componente. Se
  // ajusta durante el render (patron recomendado por React para
  // "resetear estado cuando cambia una prop"), no en un efecto, para no
  // disparar un set-state sincrono dentro de un effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSearchTerm('')
      setMode(initialMode)
      setSelectedProducts([])
    }
  }

  const toggleSelected = (product: ProductLookupItem) => {
    setSelectedProducts((prev) =>
      prev.some((selected) => selected.id === product.id)
        ? prev.filter((selected) => selected.id !== product.id)
        : [...prev, product],
    )
  }

  const handleConfirmMany = () => {
    onSelectMany?.(selectedProducts)
    setSelectedProducts([])
  }

  // `limit: 50` (techo real del lookup, `LOOKUP_MAX_LIMIT` en el backend
  // `shared/utils/lookup.ts`, Bloque 1 aprobado): antes de este bloque el
  // dialogo pedia `limit: 100` (techo de la tabla) para que la busqueda en
  // blanco mostrara casi todo el catalogo; el lookup tiene un techo propio
  // mas bajo POR DISEÑO (pensado para busqueda, no para "traer todo el
  // catalogo de una vez" — ver analisis aprobado). Con 50 se pide el
  // maximo que el lookup permite; sigue siendo menos que el catalogo
  // completo si este supera 50 productos activos, a diferencia del
  // comportamiento anterior con 100. No se sube este limite (seria
  // repetir el mismo antipatron que esta arquitectura reemplaza) — la
  // forma correcta de ver mas alla de 50 es escribir un termino de
  // busqueda mas especifico.
  const { data, isLoading, isError, error } = useProductLookup({
    active: true,
    search: debouncedSearchTerm || undefined,
    limit: 50,
  })

  const products = data?.data ?? []

  // Impuestos activos para el `QuickProductForm` embebido — mismo criterio
  // que `CreateProductPage.tsx` (unica fuente de verdad de este mapeo
  // id/name, no se reimplementa aca). Ya no se fetchean categorias aca:
  // `ProductCategoryField.tsx` (usado por `QuickProductForm`) resuelve la
  // categoria elegida por su propio id, no contra una lista pasada por prop.
  //
  // Arquitectura de selectores, Bloque 3: consume el patron de lookup
  // (`GET /taxes/lookup`), no `GET /taxes` — impuestos como catalogo de
  // referencia acotado.
  const { data: taxesResponse } = useTaxLookup({ active: true })
  const taxes = (taxesResponse?.data ?? []).map((tax) => ({
    id: tax.id,
    name: tax.label,
  }))

  const {
    mutate: createProduct,
    isPending: isCreatingProduct,
    isError: isCreateProductError,
    error: createProductError,
  } = useCreateProduct()

  const handleCreateProduct = (values: CreateProductDto) => {
    createProduct(values, {
      onSuccess: (product) => {
        toast.success('Producto creado correctamente.')
        onSelect(toLookupItem(product))
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex w-[95vw] flex-col gap-0 p-0',
          mode === 'search' ? 'h-[85vh] max-h-[720px] max-w-3xl' : 'max-h-[85vh] max-w-xl',
        )}
      >
        {mode === 'search' ? (
          <SearchPickerPanel
            title={isMultiple ? 'Agregar varios productos' : 'Buscar producto'}
            description={
              isMultiple
                ? 'Busca y tildá los productos que querés agregar, luego confirmá todos juntos.'
                : 'Busca por nombre, SKU o código de barras para agregarlo a la compra.'
            }
            searchInputId="purchase-product-search"
            searchLabel="Buscar producto"
            searchPlaceholder="Nombre, SKU o código de barras"
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            createLabel="Crear producto nuevo"
            onCreateNew={() => setMode('create')}
            isLoading={isLoading}
            isError={isError}
            errorMessage={error?.message ?? 'Ocurrió un error al buscar productos.'}
            loadingMessage="Buscando productos..."
            emptyMessage={
              <EmptyState
                icon={PackageSearch}
                title="No se encontraron productos"
                description={
                  debouncedSearchTerm
                    ? `No hay resultados para "${debouncedSearchTerm}". Probá con otro nombre, SKU o código de barras.`
                    : 'Todavía no hay productos activos en el catálogo.'
                }
              />
            }
            items={products}
            getItemKey={(product) => product.id}
            renderItem={(product) => {
              const isSelected = isMultiple && selectedProducts.some((selected) => selected.id === product.id)

              return (
                <button
                  type="button"
                  onClick={() => (isMultiple ? toggleSelected(product) : onSelect(product))}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-lg border border-transparent p-3.5 text-left transition-colors duration-200 ease-out hover:bg-brand/5',
                    'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                    isSelected && 'border-brand/30 bg-brand/5 hover:bg-brand/10',
                  )}
                >
                  {isMultiple && (
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-md border',
                        isSelected
                          ? 'border-brand bg-brand text-brand-foreground'
                          : 'border-input bg-transparent',
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && <Check className="size-3.5" />}
                    </span>
                  )}

                  <ProductThumbnail
                    imageUrl={product.thumbnail}
                    title={product.label}
                    containerClassName="size-11 shrink-0 rounded-full"
                    textClassName="text-lg text-brand/45"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[0.9375rem] font-semibold text-foreground">
                      {product.label}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {product.sku && (
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {product.sku}
                        </span>
                      )}
                      <Badge variant="muted">{product.categoryName}</Badge>
                      <Badge variant="muted">
                        {product.taxName} {product.taxRate}%
                      </Badge>
                    </span>
                  </span>

                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-base font-bold tabular-nums text-brand">
                      {formatCurrency(product.price)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      /{UNIT_LABELS[product.unitOfMeasure]}
                    </span>
                  </span>
                </button>
              )
            }}
            footer={
              isMultiple ? (
                <div className="flex items-center justify-between gap-3 border-t bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedProducts.length === 0
                      ? 'Ningún producto seleccionado'
                      : `${selectedProducts.length} producto${selectedProducts.length === 1 ? '' : 's'} seleccionado${selectedProducts.length === 1 ? '' : 's'}`}
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedProducts.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedProducts([])}
                      >
                        Limpiar selección
                      </Button>
                    )}
                    <Button type="button" disabled={selectedProducts.length === 0} onClick={handleConfirmMany}>
                      Agregar{selectedProducts.length > 0 ? ` (${selectedProducts.length})` : ''}
                    </Button>
                  </div>
                </div>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="border-b p-5">
              <DialogHeader className="flex-row items-center gap-3 pr-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <PackagePlus className="size-4.5" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <DialogTitle>Nuevo producto</DialogTitle>
                  <DialogDescription>
                    Se agregará a la compra automáticamente al guardarlo.
                  </DialogDescription>
                </div>
              </DialogHeader>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {isCreateProductError && (
                <ErrorAlert>{getProductErrorMessage(createProductError)}</ErrorAlert>
              )}

              <QuickProductForm
                taxes={taxes}
                isSubmitting={isCreatingProduct}
                onSubmit={handleCreateProduct}
              />
            </div>

            {/*
              Footer fijo, fuera del area con scroll de arriba: "Guardar"
              dispara el submit de `QuickProductForm` desde afuera de su
              `<form>` via el atributo HTML `form="quick-product-form"`
              (mismo id que ese componente define internamente) — asi
              Cancelar/Guardar quedan siempre visibles sin importar cuanto
              contenido este expandido en "Opciones avanzadas".
            */}
            <DialogFooter className="border-t bg-card px-5 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={isCreatingProduct}
                onClick={() => setMode('search')}
              >
                Cancelar
              </Button>
              <Button type="submit" form="quick-product-form" disabled={isCreatingProduct}>
                {isCreatingProduct ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
