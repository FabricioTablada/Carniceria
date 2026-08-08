import { useState } from 'react'
import { toast } from 'sonner'
import { Truck } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SearchPickerPanel } from '@/components/ui/SearchPickerPanel'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useSupplierLookup } from '../hooks/useSupplierLookup'
import { useCreateSupplier } from '../hooks/useCreateSupplier'
import { getSupplierErrorMessage } from '../utils/supplierErrors'
import { SupplierForm } from './SupplierForm'
import type { LookupItem } from '@/types/lookup'
import type { CreateSupplierDto } from '../types/supplier.types'

interface SupplierSearchDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin estado propio de apertura. */
  open: boolean
  /** Se dispara cuando el dialogo pide cambiar su estado (cerrar, Escape, click afuera). */
  onOpenChange: (open: boolean) => void
  /** Se dispara cuando el usuario elige un proveedor de los resultados, o
   * termina de crear uno nuevo desde el mismo dialogo — mismo criterio que
   * `ProductSearchDialog.tsx`/`CategorySearchDialog.tsx`. */
  onSelect: (supplier: LookupItem) => void
}

/**
 * features/suppliers/components/SupplierSearchDialog.tsx
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 3: reemplaza el `<Select>` sin
 * busqueda de `PurchaseHeaderFields.tsx` (poblado con `useSuppliers`,
 * capado en el default de la tabla, sin forma de buscar) — mismo patron
 * exacto que `ProductSearchDialog.tsx`/`CategorySearchDialog.tsx` (Bloque
 * 2): `useDebouncedValue` + `SearchPickerPanel`, consumiendo
 * `useSupplierLookup` (`GET /suppliers/lookup`), no `GET /suppliers`.
 *
 * Fila de resultado deliberadamente simple (solo nombre, sin badges): el
 * `<Select>` original tampoco mostraba mas que el nombre del proveedor, y
 * `LookupItem` (`{id,label}`, generico) es exactamente suficiente — a
 * diferencia de Productos/Categorias, Proveedores no necesito un DTO de
 * lookup especifico con campos extra.
 *
 * Segundo modo ("crear proveedor"): reutiliza `SupplierForm.tsx` (el mismo
 * formulario de `CreateSupplierPage.tsx` — no existe una version "rapida"
 * separada para Proveedores, a diferencia de Productos con
 * `QuickProductForm`) y `useCreateSupplier` (no se duplica la mutacion ni
 * su invalidacion de `['suppliers']`). El proveedor recien creado se
 * traduce a `LookupItem` antes de salir por `onSelect`, mismo criterio que
 * los otros dos dialogos.
 */
export function SupplierSearchDialog({ open, onOpenChange, onSelect }: SupplierSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm)
  const [mode, setMode] = useState<'search' | 'create'>('search')

  // Mismo patron que ProductSearchDialog.tsx/CategorySearchDialog.tsx: se
  // ajusta durante el render (no en un efecto) para no disparar un
  // set-state sincrono dentro de un effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setSearchTerm('')
      setMode('search')
    }
  }

  const { data, isLoading, isError, error } = useSupplierLookup({
    active: true,
    search: debouncedSearchTerm || undefined,
    limit: 50,
  })

  const suppliers = data?.data ?? []

  const {
    mutate: createSupplier,
    isPending: isCreatingSupplier,
    isError: isCreateSupplierError,
    error: createSupplierError,
  } = useCreateSupplier()

  const handleCreateSupplier = (values: CreateSupplierDto) => {
    createSupplier(values, {
      onSuccess: (supplier) => {
        toast.success('Proveedor creado correctamente.')
        onSelect({ id: supplier.id, label: supplier.name })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[75vh] max-h-[640px] w-[90vw] max-w-xl flex-col gap-0 p-0">
        {mode === 'search' ? (
          <SearchPickerPanel
            title="Buscar proveedor"
            description="Busca por nombre para asignarlo a la compra."
            searchInputId="supplier-search"
            searchLabel="Buscar proveedor"
            searchPlaceholder="Nombre del proveedor"
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            createLabel="Crear proveedor"
            onCreateNew={() => setMode('create')}
            isLoading={isLoading}
            isError={isError}
            errorMessage={error?.message ?? 'Ocurrió un error al buscar proveedores.'}
            loadingMessage="Buscando proveedores..."
            emptyMessage="No se encontraron proveedores."
            items={suppliers}
            getItemKey={(supplier) => supplier.id}
            renderItem={(supplier) => (
              <button
                type="button"
                onClick={() => onSelect(supplier)}
                className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Truck className="size-5" />
                </span>
                <span className="truncate text-base font-semibold text-foreground">
                  {supplier.label}
                </span>
              </button>
            )}
          />
        ) : (
          <>
            <div className="border-b p-5">
              <DialogHeader>
                <DialogTitle>Nuevo proveedor</DialogTitle>
                <DialogDescription>
                  Se asignará a la compra automáticamente al guardarlo.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {isCreateSupplierError && (
                <ErrorAlert>{getSupplierErrorMessage(createSupplierError)}</ErrorAlert>
              )}

              <SupplierForm
                mode="create"
                isSubmitting={isCreatingSupplier}
                onSubmit={handleCreateSupplier}
                onCancel={() => setMode('search')}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
