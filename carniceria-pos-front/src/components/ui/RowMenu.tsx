import { Children, cloneElement, isValidElement, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { MoreHorizontal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { cn } from '@/lib/utils'

/**
 * components/ui/RowMenu.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 4: menu contextual de acciones por fila
 * ("..."), sobre `Popover.tsx` (ya existente) — mismo criterio que
 * `NotificationBell.tsx`, el unico consumidor de `Popover` hasta ahora.
 *
 * Reemplaza el patron anterior de N botones-icono sueltos en la columna
 * "Acciones" (ej. `ProductsTable.tsx` con un lapiz + un boton
 * activar/desactivar) por un unico trigger que agrupa las acciones —
 * "acciones agrupadas" del brief de Bloque 4. Generico y sin logica de
 * dominio: no sabe nada de productos ni de ningun otro modulo, queda
 * disponible para el resto de las ~20 tablas cuando les toque su propio
 * bloque.
 */
interface RowMenuProps {
  /** Texto accesible del boton "...". */
  label: string
  children: ReactNode
}

export function RowMenu({ label, children }: RowMenuProps) {
  // Controlado localmente (en vez de dejar que `Popover` maneje su propio
  // estado, como hace `NotificationBell.tsx`) solo para poder cerrarlo al
  // hacer click en un `RowMenuItem` — un menu de acciones que queda
  // abierto de fondo tras elegir una accion (ej. detras del
  // `ConfirmDialog` de activar/desactivar) se siente roto.
  const [open, setOpen] = useState(false)

  const items = Children.map(children, (child) => {
    if (!isValidElement<RowMenuItemProps>(child)) return child

    return cloneElement(child, {
      onClick: () => {
        child.props.onClick()
        setOpen(false)
      },
    })
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground',
          'transition-colors duration-150 hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
        )}
      >
        <MoreHorizontal className="size-4" />
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-44 p-1.5">
        <div className="flex flex-col gap-0.5">{items}</div>
      </PopoverContent>
    </Popover>
  )
}

interface RowMenuItemProps {
  onClick: () => void
  icon?: LucideIcon
  destructive?: boolean
  children: ReactNode
}

export function RowMenuItem({ onClick, icon: Icon, destructive, children }: RowMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-muted',
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      {children}
    </button>
  )
}
