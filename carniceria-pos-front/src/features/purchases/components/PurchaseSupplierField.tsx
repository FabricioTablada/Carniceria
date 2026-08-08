import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSupplier } from '@/features/suppliers/hooks/useSupplier'
import { SupplierSearchDialog } from '@/features/suppliers/components/SupplierSearchDialog'
import type { LookupItem } from '@/types/lookup'

interface PurchaseSupplierFieldProps {
  id: string
  /** id del `supplierId` seleccionado (o `''` si ninguno). Componente
   * controlado, sin estado propio de seleccion — el padre
   * (`PurchaseHeaderFields`, vía `Controller`) es quien guarda el valor
   * real. Mismo criterio que `ProductCategoryField.tsx`. */
  value: string
  /** Se dispara con el nuevo `supplierId` al elegir un proveedor. */
  onChange: (supplierId: string) => void
  error?: string
  disabled?: boolean
  /**
   * QA.7 (Proveedores): proveedor ya conocido al montar el campo (nombre
   * incluido) — lo pasa `EditPurchasePage.tsx` a partir del `purchase.supplier`
   * ya obtenido junto con la compra (`GET /purchases/:id`, que SI incluye el
   * proveedor aunque este soft-eliminado, via `include`). Sin este valor, el
   * campo dependia unicamente de `useSupplier(value)` (`GET /suppliers/:id`)
   * para mostrar el nombre — esa consulta SI aplica el filtro global de
   * borrado logico y devuelve 404 si el proveedor de la compra fue eliminado
   * despues de crearla (el modulo de Proveedores no bloquea esa eliminacion),
   * mostrando "Seleccionar proveedor" como si no hubiera proveedor asignado,
   * aunque `value`/`supplierId` seguia correcto. Bug real, reproducido
   * empiricamente en QA.7.
   */
  initialSupplier?: { id: string; name: string } | null
}

/**
 * features/purchases/components/PurchaseSupplierField.tsx
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 3: reemplaza el `<Select>` con el
 * catalogo completo de proveedores (que no escala) por un boton que abre
 * `SupplierSearchDialog.tsx` — mismo patron exacto que
 * `ProductCategoryField.tsx` (buscar antes de elegir).
 *
 * Resuelve el nombre del proveedor ya seleccionado por id directo
 * (`useSupplier`, `GET /suppliers/:id`), no contra una lista separada que
 * podria no contenerlo (misma causa raiz ya corregida en
 * `ProductCategoryField.tsx`/`PurchaseItemsField.tsx`: dos fuentes de
 * datos independientes que pueden desincronizarse). Extraido de
 * `PurchaseHeaderFields.tsx` porque ese componente es generico sobre
 * `TFieldValues` (compartido por creacion/edicion) y este campo no
 * necesita serlo.
 */
export function PurchaseSupplierField({
  id,
  value,
  onChange,
  error,
  disabled = false,
  initialSupplier = null,
}: PurchaseSupplierFieldProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // QA.7: estado inicial perezoso a partir de `initialSupplier` (solo si
  // coincide con `value`) — evita depender de `useSupplier(value)` para
  // mostrar el nombre del proveedor ya asignado, ver doc del prop arriba.
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string } | null>(
    () => (initialSupplier && initialSupplier.id === value ? initialSupplier : null),
  )

  const needsResolveById = Boolean(value) && selectedSupplier?.id !== value
  const { data: resolvedSupplier } = useSupplier(needsResolveById ? value : '')

  const displaySupplier = selectedSupplier?.id === value ? selectedSupplier : resolvedSupplier

  const handleSelect = (supplier: LookupItem) => {
    setSelectedSupplier({ id: supplier.id, name: supplier.label })
    onChange(supplier.id)
    setIsDialogOpen(false)
  }

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-invalid={!!error}
        onClick={() => setIsDialogOpen(true)}
        className="w-full justify-between font-normal"
      >
        <span className={cn('truncate', !displaySupplier && 'text-muted-foreground')}>
          {displaySupplier?.name ?? 'Seleccionar proveedor'}
        </span>
        <Search className="size-4 shrink-0 text-muted-foreground" />
      </Button>

      <SupplierSearchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSelect={handleSelect}
      />
    </>
  )
}
