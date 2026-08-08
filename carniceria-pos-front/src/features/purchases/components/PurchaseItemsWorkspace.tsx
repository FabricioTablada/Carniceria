import { useState } from 'react'
import { useFieldArray } from 'react-hook-form'
import type {
  Control,
  FieldErrors,
  UseFormSetValue,
} from 'react-hook-form'
import { Copy, FileSpreadsheet, HelpCircle, Layers, PackagePlus, Plus, Search, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTaxLookup } from '@/features/taxes/hooks/useTaxLookup'
import type { ProductLookupItem } from '@/features/products/types/product.types'
import { EMPTY_ITEM, NO_TAX_VALUE } from '../utils/purchase.utils'
import { PurchaseItemCard } from './PurchaseItemCard'
import { ProductSearchDialog } from './ProductSearchDialog'
import { DuplicatePurchaseDialog } from './DuplicatePurchaseDialog'
import type { CreatePurchaseDto, Purchase } from '../types/purchase.types'

interface PurchaseItemsWorkspaceProps {
  control: Control<CreatePurchaseDto>
  setValue: UseFormSetValue<CreatePurchaseDto>
  errors: FieldErrors<CreatePurchaseDto>
  isSubmitting?: boolean
  /** Rediseño de Compras: acción rápida "Duplicar compra anterior" — este
   * componente solo abre el picker; precargar el formulario completo
   * (proveedor/notas/líneas) es responsabilidad de `PurchaseForm.tsx`
   * (único que tiene `reset()` del formulario entero). */
  onDuplicatePurchase: (purchase: Purchase) => void
  /** Rediseño de Proveedores (aprobado): "Nueva compra a este proveedor"
   * llega con el proveedor ya preseleccionado (`PurchaseForm.tsx`) — este
   * flag abre el mismo diálogo de "Agregar producto" de siempre
   * automáticamente al montar, para que el usuario ya tenga el buscador
   * de productos listo en vez de tener que presionar el botón. Opcional,
   * `false`/ausente por defecto: el resto de los casos (compra nueva sin
   * proveedor preseleccionado, edición) no cambian. */
  autoOpenAddProduct?: boolean
}

/**
 * features/purchases/components/PurchaseItemsWorkspace.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — reemplaza `PurchaseItemsField.tsx` (tabla) por un
 * espacio de trabajo de tarjetas expandibles (`PurchaseItemCard.tsx`).
 * Preserva TODA la lógica ya existente (agregar una/varias líneas, crear
 * producto embebido, impuesto aplicado a todas las líneas, autocompletado
 * de costo/impuesto) — solo cambia cómo se agregan las líneas (barra de
 * acciones rápidas, ahora también con "Crear producto" directo y
 * "Duplicar compra anterior") y cómo se ve cada línea (tarjeta, no fila).
 */
export function PurchaseItemsWorkspace({
  control,
  setValue,
  errors,
  isSubmitting = false,
  onDuplicatePurchase,
  autoOpenAddProduct = false,
}: PurchaseItemsWorkspaceProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const { data: taxesResponse } = useTaxLookup({ active: true })
  const taxes = (taxesResponse?.data ?? []).map((tax) => ({ id: tax.id, name: tax.label }))

  const [bulkTaxId, setBulkTaxId] = useState<string>(NO_TAX_VALUE)

  const handleApplyTaxToAll = () => {
    const taxId = bulkTaxId === NO_TAX_VALUE ? null : bulkTaxId

    fields.forEach((_, index) => {
      setValue(`items.${index}.taxId`, taxId)
    })
  }

  // Rediseño de Proveedores (aprobado): "foco listo para comenzar a
  // agregar productos" — inicializa el diálogo de "Agregar producto" ya
  // abierto cuando se llega con un proveedor preseleccionado, en vez de
  // abrirlo con un efecto (evita un setState síncrono dentro de un
  // efecto). `editingIndex`/`selectionMode`/`dialogInitialMode` ya
  // arrancan en los mismos valores que usa `openAddProductDialog`
  // (`null`/`'single'`/`'search'`), así que no necesitan ningún cambio.
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(autoOpenAddProduct)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple'>('single')
  const [dialogInitialMode, setDialogInitialMode] = useState<'search' | 'create'>('search')

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)

  // Tarjetas expandidas — por `field.id` (estable entre renders), no por
  // índice (que cambia si se elimina una línea anterior). Todas colapsadas
  // por defecto: la tarjeta ya muestra lo esencial (producto/cantidad/
  // costo/subtotal) sin necesidad de expandir nada.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (fieldId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) {
        next.delete(fieldId)
      } else {
        next.add(fieldId)
      }
      return next
    })
  }

  const openAddProductDialog = () => {
    setEditingIndex(null)
    setSelectionMode('single')
    setDialogInitialMode('search')
    setIsSearchDialogOpen(true)
  }

  const openCreateProductDialog = () => {
    setEditingIndex(null)
    setSelectionMode('single')
    setDialogInitialMode('create')
    setIsSearchDialogOpen(true)
  }

  const openBulkAddDialog = () => {
    setEditingIndex(null)
    setSelectionMode('multiple')
    setDialogInitialMode('search')
    setIsSearchDialogOpen(true)
  }

  const openEditProductDialog = (index: number) => {
    setEditingIndex(index)
    setSelectionMode('single')
    setDialogInitialMode('search')
    setIsSearchDialogOpen(true)
  }

  const populatePurchaseItemFromProduct = (index: number, product: ProductLookupItem) => {
    setValue(`items.${index}.productId`, product.id)
    setValue(`items.${index}.unitCost`, product.price)
    setValue(`items.${index}.taxId`, product.taxId)
    setValue(`items.${index}.expectedWastePercent`, product.expectedWastePercent)
  }

  const handleDialogSelect = (product: ProductLookupItem) => {
    if (editingIndex === null) {
      const newIndex = fields.length
      append(EMPTY_ITEM)
      populatePurchaseItemFromProduct(newIndex, product)
    } else {
      populatePurchaseItemFromProduct(editingIndex, product)
    }

    setIsSearchDialogOpen(false)
  }

  const handleDialogSelectMany = (selectedProducts: ProductLookupItem[]) => {
    if (selectedProducts.length === 0) {
      setIsSearchDialogOpen(false)
      return
    }

    const startIndex = fields.length
    append(selectedProducts.map(() => EMPTY_ITEM))
    selectedProducts.forEach((product, offset) => {
      populatePurchaseItemFromProduct(startIndex + offset, product)
    })

    setIsSearchDialogOpen(false)
  }

  const handleDuplicateSelect = (purchase: Purchase) => {
    setIsDuplicateDialogOpen(false)
    onDuplicatePurchase(purchase)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={isSubmitting}
          onClick={openAddProductDialog}
          className="bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
        >
          <Plus className="size-4" />
          Agregar producto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          onClick={openBulkAddDialog}
          className="border-brand text-brand hover:bg-brand/5 hover:text-brand"
        >
          <Layers className="size-4" />
          Agregar varios
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          onClick={openCreateProductDialog}
        >
          <PackagePlus className="size-4" />
          Crear producto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          onClick={() => setIsDuplicateDialogOpen(true)}
        >
          <Copy className="size-4" />
          Duplicar compra anterior
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isSubmitting}
          onClick={() => setIsImportDialogOpen(true)}
          className="text-muted-foreground hover:bg-muted"
        >
          <FileSpreadsheet className="size-4" />
          Cargar desde archivo
        </Button>
      </div>

      {fields.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label className="items-center gap-1.5 text-sm text-muted-foreground">
            <Tag className="size-4 text-brand" />
            Impuesto para toda la compra
            <HelpCircle className="size-3.5" aria-hidden="true" />
          </Label>
          <div className="flex items-center gap-2">
            <Select value={bulkTaxId} onValueChange={(value: unknown) => setBulkTaxId(value as string)}>
              <SelectTrigger
                aria-label="Impuesto para todas las líneas"
                disabled={isSubmitting}
                className="w-full max-w-56"
              >
                <SelectValue>
                  {(value: unknown) => {
                    const taxId = value as string
                    if (taxId === NO_TAX_VALUE) return 'Sin impuesto'
                    return taxes.find((tax) => tax.id === taxId)?.name ?? taxId
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TAX_VALUE}>Sin impuesto</SelectItem>
                {taxes.map((tax) => (
                  <SelectItem key={tax.id} value={tax.id}>
                    {tax.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={handleApplyTaxToAll}
              className="border-brand text-brand hover:bg-brand/5 hover:text-brand"
            >
              Aplicar a todas
            </Button>
          </div>
        </div>
      )}

      {errors.items?.root && <p className="text-sm text-destructive">{errors.items.root.message}</p>}
      {errors.items && !Array.isArray(errors.items) && !errors.items.root && (
        <p className="text-sm text-destructive">{errors.items.message}</p>
      )}

      {fields.length === 0 ? (
        <div className="rounded-xl border py-10">
          <EmptyState
            icon={Search}
            title="Todavía no agregaste productos"
            description="Usá los botones de arriba para buscar y agregar los productos de esta compra."
            action={{ label: 'Agregar producto', onClick: openAddProductDialog, variant: 'brand' }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => {
            const itemErrors = Array.isArray(errors.items) ? errors.items[index] : undefined

            return (
              <PurchaseItemCard
                key={field.id}
                control={control}
                index={index}
                taxes={taxes}
                itemErrors={itemErrors}
                isSubmitting={isSubmitting}
                canRemove
                onRemove={() => remove(index)}
                onEditProduct={openEditProductDialog}
                isExpanded={expandedIds.has(field.id)}
                onToggleExpand={() => toggleExpanded(field.id)}
              />
            )
          })}
        </div>
      )}

      <ProductSearchDialog
        open={isSearchDialogOpen}
        onOpenChange={setIsSearchDialogOpen}
        onSelect={handleDialogSelect}
        selectionMode={selectionMode}
        onSelectMany={handleDialogSelectMany}
        initialMode={dialogInitialMode}
      />

      <DuplicatePurchaseDialog
        open={isDuplicateDialogOpen}
        onOpenChange={setIsDuplicateDialogOpen}
        onSelect={handleDuplicateSelect}
      />

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cargar desde archivo</DialogTitle>
            <DialogDescription>
              La importación de productos desde Excel/CSV todavía no está disponible — quedará
              lista en un sprint futuro. Por ahora, usá "Agregar producto" o "Agregar varios" para
              cargar la compra.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setIsImportDialogOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
