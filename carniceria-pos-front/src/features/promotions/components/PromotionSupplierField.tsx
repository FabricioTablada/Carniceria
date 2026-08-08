import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSupplier } from '@/features/suppliers/hooks/useSupplier'
import { SupplierSearchDialog } from '@/features/suppliers/components/SupplierSearchDialog'
import type { LookupItem } from '@/types/lookup'

interface PromotionSupplierFieldProps {
  id: string
  /** id del `supplierId` seleccionado (o `''`/`null` si ninguno).
   * Componente controlado, sin estado propio de seleccion — el padre
   * (`PromotionForm.tsx`, vía `Controller`) es quien guarda el valor
   * real. Mismo criterio que `PurchaseSupplierField.tsx` (Compras). */
  value: string | null
  /** Se dispara con el nuevo `supplierId` (o `null` para "sin proveedor")
   * al elegir/quitar un proveedor. */
  onChange: (supplierId: string | null) => void
  error?: string
  disabled?: boolean
  /**
   * QA.9 (Promociones): mismo hallazgo/mismo fix que
   * `PurchaseSupplierField.tsx` (QA.7) — proveedor ya conocido al montar
   * el campo (nombre incluido), pasado por `EditPromotionPage.tsx` desde
   * `promotion.supplier` (ya incluido en `GET /promotions/:id`, que SI
   * trae el proveedor aunque este soft-eliminado, via `include`). Sin
   * este valor, el campo dependia unicamente de `useSupplier(value)`
   * (`GET /suppliers/:id`, que SI aplica el filtro global de borrado
   * logico) para mostrar el nombre — si el proveedor de la promocion fue
   * eliminado despues de asociarla (el modulo de Proveedores no bloquea
   * esa eliminacion), esa consulta devuelve 404 y el campo mostraba "Sin
   * proveedor" como si no hubiera proveedor asignado, aunque `value`
   * seguia correcto.
   */
  initialSupplier?: { id: string; name: string } | null
}

/**
 * features/promotions/components/PromotionSupplierField.tsx
 * -----------------------------------------------------------------------------
 * PROMO-07 (Commercial Pricing Engine, frontend): selector de proveedor
 * para el origen/financiamiento comercial de una promocion. Reutiliza tal
 * cual el mismo par ya existente y compartido (`SupplierSearchDialog.tsx`
 * + `useSupplier`, ambos en `features/suppliers/`) que ya consume
 * `PurchaseSupplierField.tsx` en Compras — mismo patron exacto (buscar
 * antes de elegir, resolver el nombre ya elegido por id directo en vez de
 * contra una lista separada que podria no contenerlo), solo que este
 * componente vive en `features/promotions/` porque los componentes de
 * modulo no se comparten entre features (`PurchaseSupplierField.tsx` es
 * especifico de Compras) — lo unico reutilizado son las piezas ya
 * genéricas (`SupplierSearchDialog`/`useSupplier`).
 *
 * A diferencia de Compras, el proveedor de una promocion es OPCIONAL
 * (`null` = promocion propia del negocio, sin proveedor asociado) — el
 * boton permite "Quitar proveedor" cuando ya hay uno elegido.
 */
export function PromotionSupplierField({
  id,
  value,
  onChange,
  error,
  disabled = false,
  initialSupplier = null,
}: PromotionSupplierFieldProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // QA.9: estado inicial perezoso a partir de `initialSupplier` (solo si
  // coincide con `value`) — evita depender de `useSupplier(value)` para
  // mostrar el nombre del proveedor ya asignado, ver doc del prop arriba.
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string } | null>(
    () => (initialSupplier && initialSupplier.id === value ? initialSupplier : null),
  )

  const needsResolveById = Boolean(value) && selectedSupplier?.id !== value
  const { data: resolvedSupplier } = useSupplier(needsResolveById ? (value ?? '') : '')

  const displaySupplier = selectedSupplier?.id === value ? selectedSupplier : resolvedSupplier

  const handleSelect = (supplier: LookupItem) => {
    setSelectedSupplier({ id: supplier.id, name: supplier.label })
    onChange(supplier.id)
    setIsDialogOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
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
            {displaySupplier?.name ?? 'Sin proveedor'}
          </span>
          <Search className="size-4 shrink-0 text-muted-foreground" />
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setSelectedSupplier(null)
              onChange(null)
            }}
          >
            Quitar
          </Button>
        )}
      </div>

      <SupplierSearchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSelect={handleSelect}
      />
    </>
  )
}
