import { useEffect, useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { CheckCircle2, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentRenderer } from '@/features/documents/components/DocumentRenderer'
import { cn } from '@/lib/utils'
import { useSaleDocumentActions } from '../hooks/useSaleDocumentActions'
import type { Sale } from '../types/sale.types'

/** Rediseño del POS (aprobado, "flujo posterior a la venta — auto-cierre"):
 * suficiente para que el cajero vea el folio/total sin tener que cerrar a
 * mano en el caso más común (no imprime ni descarga nada) — no tan corto
 * como para sentirse apurado. */
const AUTO_CLOSE_DELAY_MS = 6000

/** Bloque 6.3: altura máxima del scroll interno de la tabla "Detalle" (ver
 * `DocumentRenderer`'s `detailMaxHeight`) — deja ver varias filas sin
 * scroll en el caso común, y evita que una venta con muchos productos
 * empuje el encabezado/resumen/botones fuera de vista. */
const DETAIL_MAX_HEIGHT = '20rem'

interface SaleReceiptDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin estado propio. */
  open: boolean
  /** Se dispara cuando el dialogo pide cambiar su estado (cerrar, Escape, click afuera). */
  onOpenChange: (open: boolean) => void
  /** Venta recien confirmada. `null` mientras no hay ninguna que mostrar. */
  sale: Sale | null
}

/**
 * features/sales/components/SaleReceiptDialog.tsx
 * -----------------------------------------------------------------------------
 * Comprobante visual tras completar una venta en el POS. Puramente
 * informativo: no requiere confirmar ni cancelar ninguna accion, por eso se
 * construye sobre el primitivo `Dialog` de `@base-ui/react` (proposito
 * general) y no sobre `AlertDialog`, que ya usa `ConfirmDialog.tsx`
 * especificamente para confirmar acciones destructivas.
 *
 * Bloque 13.5 — primera integracion real del Motor de Documentos: el
 * contenido del comprobante (antes un resumen propio de Ventas, con su
 * propio diseño) ya no existe aca. `buildSaleDocumentData(sale)`
 * (`../utils/saleReceiptBuilder.ts`) transforma la venta en `DocumentData`,
 * y `<DocumentRenderer data={documentData} />` (`features/documents`, sin
 * modificar) es quien lo dibuja — este archivo no conoce la estructura
 * interna de `DocumentRenderer`, solo le pasa el dato ya construido.
 * `SaleReceiptBuilder -> DocumentData -> DocumentRenderer`, sin romper esa
 * cadena. El encabezado (icono + "Venta completada") sigue siendo propio de
 * este dialogo — es realimentacion del POS, no contenido del documento.
 *
 * Bloque 13.6 (impresion): "Imprimir" llama a `window.print()` directo,
 * sin estado ni logica propia — el navegador imprime la pagina completa,
 * pero la hoja de estilos de impresion (`index.css`, `@media print`,
 * enganchada via `data-document-print-root` en `DocumentRenderer.tsx`)
 * oculta todo lo que no sea el documento (este boton, "Cerrar", el icono
 * de exito, el backdrop) — asi que en el papel solo sale el comprobante.
 *
 * Bloque 13.7 (PDF): "Descargar PDF" le pide el PDF al Motor de Documentos
 * (`POST /documents/pdf`, `documentsApi.downloadPdf`). El PDF se genera
 * siempre en el backend; este componente solo dispara la descarga del
 * archivo ya recibido (`downloadBlob`).
 *
 * Bloque 13.8 (Registry): a diferencia de la vista previa/impresion (que
 * siguen usando `documentData`, construido con `buildSaleDocumentData`
 * para `DocumentRenderer`), el PDF se pide por TIPO — el backend resuelve
 * el `DocumentBuilder` de `SALE_RECEIPT` a traves del `DocumentRegistry` y
 * construye su propio `DocumentData` alla, no reutiliza el del frontend.
 *
 * Bloque 13.10: `documentData`/`isDownloadingPdf`/`handlePrint`/
 * `handleDownloadPdf` ya NO viven aca — se extrajeron a
 * `useSaleDocumentActions` (`../hooks/`) porque `SaleDetailContent.tsx`
 * (seccion "Documentos y comprobantes") necesita EXACTAMENTE esta misma
 * logica — una sola implementacion, dos consumidores.
 *
 * Bloque 6.3 (apertura arriba + compactacion + scroll acotado al Detalle):
 * ver comentarios junto al `popupRef`/`initialFocus` y a las props
 * `compact`/`detailMaxHeight` pasadas a `DocumentRenderer` mas abajo.
 *
 * Nota (Bloque 7.16): los documentos electrónicos reales de Hacienda
 * (PDF/XML) NO se descargan desde este diálogo — viven en la pestaña
 * "Documentos" de `SaleDetailContent.tsx` ("Ver factura"/"Ver XML"),
 * porque ese es el lugar al que el usuario vuelve para recuperarlos,
 * incluso días después (ver ese componente).
 */
export function SaleReceiptDialog({
  open,
  onOpenChange,
  sale,
}: SaleReceiptDialogProps) {
  const { documentData, isDownloadingPdf, handlePrint, handleDownloadPdf } =
    useSaleDocumentActions(sale)

  // Bloque 6.3: causa raíz de que el modal abriera "scrolleado" hacia los
  // botones — `DocumentRenderer` no tiene ningún elemento enfocable, así
  // que el foco automático por defecto de Base UI caía en el primer botón
  // tabbable ("Imprimir", al fondo), y el navegador hacía scroll-into-view
  // de ese botón dentro del único contenedor con `overflow-y-auto` (el
  // propio `Popup`). Enfocar el `Popup` mismo (no un botón) mantiene el
  // scroll en el tope al abrir; `tabIndex={-1}` lo hace enfocable por
  // programa sin sumarlo al orden de tabulación normal.
  const popupRef = useRef<HTMLDivElement>(null)

  // Rediseño del POS (aprobado, "flujo posterior a la venta — auto-cierre"):
  // se cierra solo tras `AUTO_CLOSE_DELAY_MS`, mismo `onOpenChange` que ya
  // usa el botón "Cerrar" — el cajero puede seguir cerrando a mano en
  // cualquier momento (el timer no bloquea nada). Se cancela mientras se
  // está generando el PDF (`isDownloadingPdf`), para no cerrar la pantalla
  // en medio de una descarga en curso.
  useEffect(() => {
    if (!open || isDownloadingPdf) {
      return
    }

    const timeoutId = setTimeout(() => {
      onOpenChange(false)
    }, AUTO_CLOSE_DELAY_MS)

    return () => clearTimeout(timeoutId)
  }, [open, isDownloadingPdf, onOpenChange])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity',
          )}
        />
        <DialogPrimitive.Popup
          ref={popupRef}
          tabIndex={-1}
          initialFocus={popupRef}
          className={cn(
            // Bloque 6.3 (ajuste): `max-w-2xl` (42rem) -> `max-w-[46rem]`
            // (~9.5% mas ancho, alto sin cambios) — el detalle necesitaba
            // ese espacio extra para que "Descripción" y los montos vuelvan
            // a verse sin comprimir.
            //
            // Bloque 7.33: el `overflow-y-auto` que antes vivia ACA (en el
            // propio Popup) hacia que, con muchos productos, todo el
            // comprobante scrolleara como una sola unidad — el encabezado y
            // los botones de accion se iban de la vista junto con la
            // tabla. Se quita de aca (el Popup ya no scrollea) y se mueve
            // al wrapper intermedio de abajo — header y botones quedan
            // como hermanos `flex-shrink-0` fuera de esa zona, siempre
            // visibles sin importar cuantos productos tenga la venta.
            'fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-full max-w-[46rem] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border bg-card p-7 text-card-foreground shadow-xl outline-none',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'transition-all',
          )}
        >
          <div className="flex shrink-0 flex-col items-center gap-2.5 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="size-9 text-success" />
            </div>

            <div className="flex flex-col gap-1.5">
              <DialogPrimitive.Title className="text-2xl font-bold tracking-tight">
                Venta completada
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-base text-muted-foreground">
                La venta se registró correctamente.
              </DialogPrimitive.Description>
            </div>
          </div>

          {/* Bloque 7.33: única zona con scroll propio — en la práctica
              casi nunca llega a activarse, porque la tabla de "Detalle"
              (la única parte que crece con la cantidad de productos) ya
              tiene su propio scroll interno acotado (`detailMaxHeight`,
              dentro de `DocumentRenderer`); cliente/responsable/pagos/
              totales son secciones cortas de tamaño acotado. Este wrapper
              es solo la red de seguridad que garantiza que, aun en un caso
              extremo, el header y los botones nunca se muevan — no cambia
              nada de `DocumentRenderer` ni de su lógica. `min-h-0` es
              necesario para que un hijo `flex-1` dentro de una columna
              flex pueda scrollear en vez de crecer sin límite. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {documentData && (
              <DocumentRenderer data={documentData} compact detailMaxHeight={DETAIL_MAX_HEIGHT} />
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="h-12 flex-1 gap-2 text-base font-semibold"
            >
              <Printer className="size-4" />
              Imprimir
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="h-12 flex-1 gap-2 text-base font-semibold"
            >
              <Download className="size-4" />
              {isDownloadingPdf ? 'Generando...' : 'Descargar PDF'}
            </Button>

            <DialogPrimitive.Close
              render={
                <Button
                  type="button"
                  className="h-12 flex-1 bg-brand px-8 text-base font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                >
                  Cerrar
                </Button>
              }
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
