import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin estado propio. */
  open: boolean
  /** Se dispara cuando el dialogo pide cambiar su estado (cerrar, Escape, click afuera). */
  onOpenChange: (open: boolean) => void
  /** Titulo del dialogo. */
  title: string
  /** Texto descriptivo de la accion a confirmar (opcional). */
  description?: string
  /** Texto del boton de confirmacion. */
  confirmText?: string
  /** Texto del boton de cancelar. */
  cancelText?: string
  /** Se dispara al confirmar la accion. */
  onConfirm: () => void
  /** Deshabilita ambos botones y muestra el estado de carga en el de confirmar. */
  loading?: boolean
}

/**
 * components/ui/ConfirmDialog.tsx
 * -----------------------------------------------------------------------------
 * Dialogo de confirmacion generico y reutilizable para cualquier accion
 * destructiva del proyecto (eliminar, desactivar de forma irreversible,
 * etc.). Sin logica de dominio: no sabe nada de Suppliers ni de ningun
 * otro modulo — solo expone `title`/`description`/textos de boton y
 * delega la accion real a `onConfirm`.
 *
 * Construido sobre el primitivo `AlertDialog` de `@base-ui/react` (ya
 * instalado en el proyecto, mismo paquete que ya usa `select.tsx`), no
 * `Dialog`: `AlertDialog` es semanticamente el primitivo correcto para
 * "confirmar antes de una accion", a diferencia de `Dialog` (proposito
 * general).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity',
          )}
        />
        <AlertDialogPrimitive.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2',
            'flex flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-lg',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'transition-all',
          )}
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialogPrimitive.Title className="text-base font-semibold">
              {title}
            </AlertDialogPrimitive.Title>
            {description && (
              <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </AlertDialogPrimitive.Description>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <AlertDialogPrimitive.Close
              render={
                <Button type="button" variant="outline" disabled={loading}>
                  {cancelText}
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={onConfirm}
            >
              {loading ? 'Procesando...' : confirmText}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
