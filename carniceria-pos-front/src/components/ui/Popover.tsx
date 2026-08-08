import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { cn } from '@/lib/utils'

/**
 * components/ui/Popover.tsx
 * -----------------------------------------------------------------------------
 * Primitivo generico de panel flotante (trigger + contenido anclado),
 * construido sobre `@base-ui/react/popover` — mismo paquete y mismo
 * criterio de wrapping (funciones + `data-slot` + `cn`) que `select.tsx`
 * ya usa para `SelectContent`. No existia ningun `Popover`/`DropdownMenu`
 * en el proyecto antes de este componente (ver `UI_DESIGN_SYSTEM.md` §3/§6).
 *
 * Sin logica de dominio: no sabe nada de notificaciones ni de ningun otro
 * modulo — expone `open`/`onOpenChange` (controlado) y los 3 bloques
 * (`Popover`, `PopoverTrigger`, `PopoverContent`) para que cualquier
 * consumidor futuro (no solo el Centro de Notificaciones) arme su propio
 * contenido.
 */
function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  /** Override puntual del z-index del Positioner (por defecto `z-50`,
   * igual para todos los consumidores). Bloque POS ("Más opciones" del
   * header, `PosHeader.tsx`): dos popovers independientes (este y "Ventas
   * en espera" del carrito) pueden quedar abiertos al mismo tiempo — al
   * compartir el mismo `z-50`, el que se monto despues en el DOM gana el
   * desempate y sus filas se veian mezcladas con las de este. Elevar SOLO
   * este consumidor a `z-[60]` garantiza que siempre pinte encima, sin
   * tocar el z-index por defecto del resto de los popovers (`Popover`
   * generico, `NotificationBell.tsx`, `RowMenu.tsx`). */
  positionerClassName,
  align = 'end',
  sideOffset = 8,
  /** Version 1.1, Bloque 2 (asistente de CABYS): ancla explicita del
   * `Positioner`, para cuando el disparador NO es un `PopoverTrigger`
   * (ese primitivo fuerza `role="button"` via `useButton`, semanticamente
   * incorrecto sobre un `<input>` de texto editable — confirmado en
   * validacion real). Con esta ancla, un consumidor puede controlar
   * `Popover` directamente (`open`/`onOpenChange`) y anclar el panel a
   * cualquier elemento propio (ej. un `<input>` con su `ref`), sin pasar
   * por `PopoverTrigger`. Opcional y `undefined` por defecto — ningun
   * consumidor existente (`NotificationBell.tsx`/`PosHeader.tsx`/
   * `RowMenu.tsx`, todos con `PopoverTrigger`) pasa esta prop, asi que su
   * comportamiento no cambia. */
  anchor,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> & {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  positionerClassName?: string
  anchor?: React.ComponentProps<typeof PopoverPrimitive.Positioner>['anchor']
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        sideOffset={sideOffset}
        anchor={anchor}
        className={cn('z-50', positionerClassName)}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'z-50 rounded-xl border bg-popover text-popover-foreground shadow-md outline-none',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'transition-[opacity,transform]',
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
