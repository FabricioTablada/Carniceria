import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { SaleDetailContent } from './SaleDetailContent'

interface SaleDetailDialogProps {
  /** Id de la venta a mostrar. `null` mantiene el dialog cerrado — mismo
   * criterio ya usado por `pendingToggle` en `ProductsTable.tsx`: el id
   * seleccionado ES el estado de "abierto". */
  saleId: string | null
  onOpenChange: (open: boolean) => void
}

/**
 * features/sales/components/SaleDetailDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque 3 (integración del detalle dentro de `WorkspacePanel`, POS):
 * este archivo quedó como un envoltorio delgado — todo el contenido real
 * (detalle + anular/corregir/devolver) vive en `SaleDetailContent.tsx`
 * (extraído, sin ninguna opinión sobre su contenedor). Sigue existiendo
 * tal cual porque `CashSessionDetailPage.tsx` (Reportes) lo usa de forma
 * independiente, fuera del flujo del POS — mismo prop signature de
 * siempre (`saleId`/`onOpenChange`), cero cambios para ese consumidor.
 *
 * Bloque 11 (rediseño integral de Ventas): el límite de alto y el scroll
 * se agregan ÚNICAMENTE aca (`max-h-[85vh] overflow-y-auto` en el
 * `className` de ESTE `DialogContent`) — `components/ui/Dialog.tsx` (el
 * primitivo compartido por todos los demás dialogs del sistema) no se
 * toca, así que ningún otro dialog cambia de comportamiento. Antes, un
 * `DialogContent` sin `max-h` con una venta de 30-50 líneas crecía más
 * allá del viewport sin ninguna forma de hacer scroll (un elemento
 * `fixed` no fuerza scroll del body) — el contenido quedaba
 * silenciosamente inaccesible.
 *
 * `max-w-2xl` -> `max-w-4xl`: ancho suficiente para que la grilla de 4
 * columnas y el resumen anclado a la derecha (`@lg`, ya construidos en
 * `SaleDetailContent.tsx`) respiren con la tabla de 7 columnas de
 * productos — mismo componente, sin ninguna rama de código nueva, solo
 * más contenedor real para que sus propias reglas `@container` luzcan
 * mejor.
 *
 * Corrección de consistencia (aprobado, "ajuste fino, no un modal
 * gigante"): `max-w-4xl` (56rem/896px) -> `max-w-[64rem]` (1024px, ~+14%)
 * — únicamente el espacio extra necesario para que la tabla de Productos
 * gane ancho; se descarta una versión previa a `w-[92vw]` por sentirse
 * "el otro extremo" (demasiado grande, espacios vacíos). Estructura y
 * comportamiento sin cambios: mismo panel lateral siempre al lado de la
 * tabla (ver `SaleDetailContent.tsx`).
 */
export function SaleDetailDialog({ saleId, onOpenChange }: SaleDetailDialogProps) {
  return (
    <Dialog open={Boolean(saleId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[64rem] gap-0 overflow-y-auto">
        {saleId && <SaleDetailContent saleId={saleId} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
