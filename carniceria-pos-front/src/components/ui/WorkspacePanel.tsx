import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * components/ui/WorkspacePanel.tsx
 * -----------------------------------------------------------------------------
 * Panel lateral de trabajo, base del Design System para cualquier flujo que
 * necesite más espacio/contexto que un `Dialog` centrado sin abandonar la
 * pantalla de fondo (listados con filtros, formularios de creación/edición
 * extensos, detalle con acciones) — pensado desde el inicio para
 * reutilizarse en múltiples módulos (Ventas, Clientes, Productos, Compras,
 * Inventario, Reportes, Configuración...), no solo para "Ventas de la
 * sesión".
 *
 * DECISIÓN DE ARQUITECTURA (evaluada antes de escribir código): `@base-ui/react`
 * (ya instalado, v1.6.0) trae un primitivo `Drawer` dedicado a paneles que
 * se deslizan desde el borde. Se evaluó y se descartó a propósito — la
 * documentación oficial del propio paquete lo desaconseja para este caso:
 * "Drawer extends Dialog: it adds gesture support, snap points, and indent
 * effects. If you don't need these, use Dialog instead. A panel that slides
 * in from the edge of the screen and doesn't need gesture support is a
 * positioned Dialog." `Drawer` está pensado para bottom-sheets móviles con
 * swipe-to-dismiss — para un panel de trabajo de escritorio con formularios,
 * un swipe accidental que lo cierre sin guardar sería un riesgo real, no
 * una mejora. Por eso este componente se construye sobre el MISMO primitivo
 * que ya usa `Dialog.tsx`/`ConfirmDialog.tsx` (`@base-ui/react/dialog`),
 * solo con posición y tamaño distintos — foco, portal, backdrop, Escape y
 * bloqueo de scroll ya vienen resueltos, sin una sola línea de lógica
 * nueva, exactamente el criterio pedido de "evitar duplicar lógica ya
 * existente en Dialog/ConfirmDialog".
 *
 * Mismo lenguaje visual de base que `Dialog.tsx` (backdrop, transiciones
 * `data-[starting-style]`/`data-[ending-style]`, `Button` para cerrar) con
 * las diferencias deliberadas que corresponden a un panel de borde en vez
 * de una tarjeta centrada: sin esquinas redondeadas (toca los 3 bordes del
 * viewport), entra con un deslizamiento horizontal (`translate-x`) en vez
 * de escala+fade, y expone `WorkspacePanelBody` con scroll interno
 * garantizado por defecto (el header y el footer quedan fijos).
 *
 * API deliberadamente simetrica a `Dialog.tsx`: `WorkspacePanel` (Root),
 * `WorkspacePanelTrigger`, `WorkspacePanelClose`, `WorkspacePanelContent`,
 * `WorkspacePanelHeader`, `WorkspacePanelBody`, `WorkspacePanelFooter`,
 * `WorkspacePanelTitle`, `WorkspacePanelDescription` — quien ya conoce
 * `Dialog` no tiene que aprender un patrón nuevo. Footer/acciones quedan
 * como composicion libre (`children`, sin una forma fija de botones),
 * mismo criterio ya documentado en `PageHeader.tsx` ("este componente no
 * importa Button ni decide su variante") — `WorkspacePanel` no sabe nada
 * de ningun modulo especifico.
 */

function WorkspacePanel(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="workspace-panel" {...props} />
}

function WorkspacePanelTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="workspace-panel-trigger" {...props} />
}

function WorkspacePanelClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="workspace-panel-close" {...props} />
}

type WorkspacePanelSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/** Ancho máximo por tamaño, activo desde el breakpoint `sm:` — en
 * viewports angostos el panel ocupa el ancho completo (`w-full` en la
 * clase base de `WorkspacePanelContent`), mismo criterio "mobile primero
 * se simplifica" ya usado en el resto del Design System. Valores en px
 * (no la escala nombrada `max-w-*` de Tailwind) para que el significado de
 * cada tamaño sea explícito y no dependa de recordar a qué equivale
 * `max-w-2xl` — más fácil de mantener para quien agregue un módulo nuevo.
 *
 * `2xl` (aditivo — ningún consumidor existente lo usaba, así que ninguno
 * cambia): corrección del layout del detalle de venta dentro del POS
 * (`SessionSalesDialog.tsx`) — con `xl` (880px), el contenido útil
 * (~832px tras el padding) quedaba por debajo de lo que la tabla de
 * Productos de 7 columnas necesita para no activar su scroll horizontal
 * de seguridad (`DataTable`'s `scrollX`, ver `SaleDetailContent.tsx`),
 * aunque en el Dialog de Ventas (administración, ~984px útiles) el mismo
 * contenido ya se ve completo y sin scroll. `1120px` iguala esa holgura. */
const SIZE_CLASSNAMES: Record<WorkspacePanelSize, string> = {
  sm: 'sm:max-w-[380px]',
  md: 'sm:max-w-[480px]',
  lg: 'sm:max-w-[640px]',
  xl: 'sm:max-w-[880px]',
  '2xl': 'sm:max-w-[1120px]',
}

interface WorkspacePanelContentProps extends React.ComponentProps<typeof DialogPrimitive.Popup> {
  /** Ancho del panel. @default 'md' */
  size?: WorkspacePanelSize
  /** Muestra el botón de cerrar (X) en la esquina superior derecha. @default true */
  showCloseButton?: boolean
}

function WorkspacePanelContent({
  className,
  children,
  size = 'md',
  showCloseButton = true,
  ...props
}: WorkspacePanelContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-black/50',
          'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity',
        )}
      />
      <DialogPrimitive.Popup
        data-slot="workspace-panel-content"
        className={cn(
          // Anclado al borde derecho, alto completo — a diferencia de
          // Dialog (centrado, con esquinas redondeadas), un panel que
          // toca 3 bordes del viewport no lleva `rounded-*`.
          'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col',
          'border-l bg-card text-card-foreground shadow-2xl',
          'data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full',
          'transition-transform duration-300 ease-out',
          SIZE_CLASSNAMES[size],
          className,
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cerrar"
                className="absolute top-4 right-4 rounded-lg"
              >
                <X className="size-4" />
              </Button>
            }
          />
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function WorkspacePanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="workspace-panel-header"
      // Correccion de causa raiz (aprobado, "Footer cortado en Drawers
      // con contenido largo"): `shrink-0` — sin el, este header es el
      // unico elemento del `flex flex-col` de `WorkspacePanelContent`
      // (junto a cualquier barra extra que un Drawer agregue antes,
      // ej. "Anterior/Siguiente" de `ProductDrawer.tsx`) que participaba
      // del calculo de encogimiento con el valor por defecto
      // (`flex-shrink: 1`) en vez de estar explicitamente excluido, como
      // ya estaban `WorkspacePanelFooter` (`shrink-0`) y cualquier barra
      // adicional (siempre agregada con `shrink-0` a mano). Inconsistente
      // entre hermanos del mismo `flex-col` — aditivo/sin riesgo: en el
      // caso normal (contenido que entra en pantalla) no cambia nada, el
      // encogimiento solo participa cuando el contenido total supera el
      // alto disponible.
      className={cn('flex shrink-0 flex-col gap-1.5 border-b px-6 py-5 pr-14', className)}
      {...props}
    />
  )
}

/** Única región con scroll del panel — header y footer quedan siempre
 * visibles. `flex-1 overflow-y-auto` viene garantizado por el componente,
 * no es una convención que cada módulo tenga que recordar aplicar.
 *
 * Correccion de causa raiz (aprobado): `min-h-0` explicito junto a
 * `flex-1 overflow-y-auto`. Sin el, el tamaño minimo automatico de este
 * item de flex depende de que el navegador infiera que `overflow` no es
 * `visible` para resolverlo a 0 — con contenido de un Drawer
 * suficientemente largo (ej. `ProductDrawer.tsx` con las 5 secciones +
 * descripcion), esa inferencia podia no ganarle a la suma de alturas de
 * los demas hermanos del `flex-col` (header/footer/barras extra),
 * dejando que la COLUMNA COMPLETA creciera mas alla del `h-full` fijo de
 * `WorkspacePanelContent` (`fixed inset-y-0`, sin scroll propio) en vez
 * de que unicamente este `<div>` scrollee internamente — el sintoma
 * exacto reportado: el Footer (ultimo hermano) empujado fuera del
 * viewport visible, sin ningun mecanismo de scroll que lo alcance. Fix
 * de causa raiz, no de sintoma: `min-h-0` fuerza ese minimo a 0 de forma
 * explicita, sin depender de la inferencia. Mismo componente para los
 * 15+ Drawers del ERP — sin riesgo, min-h-0 solo actua cuando el
 * contenido excede el alto disponible. */
function WorkspacePanelBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="workspace-panel-body"
      className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)}
      {...props}
    />
  )
}

/** Opcional: un panel de solo lectura (ej. un detalle sin acciones) puede
 * omitirlo por completo — no hay ninguna lógica que dependa de su
 * presencia. */
function WorkspacePanelFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="workspace-panel-footer"
      className={cn('flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4', className)}
      {...props}
    />
  )
}

function WorkspacePanelTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="workspace-panel-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  )
}

function WorkspacePanelDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="workspace-panel-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  WorkspacePanel,
  WorkspacePanelTrigger,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelHeader,
  WorkspacePanelBody,
  WorkspacePanelFooter,
  WorkspacePanelTitle,
  WorkspacePanelDescription,
}
export type { WorkspacePanelSize }
