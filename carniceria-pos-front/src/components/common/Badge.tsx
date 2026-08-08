import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * components/common/Badge.tsx
 * -----------------------------------------------------------------------------
 * Unifica las 3 combinaciones de color que hoy existen duplicadas, byte a
 * byte, en 8 archivos distintos (TaxStatusBadge, CategoryStatusBadge,
 * RoleStatusBadge, ProductStatusBadge, SupplierStatusBadge, UserStatusBadge,
 * UserRoleBadge, RolePermissionBadge) y en el badge de estado inline de
 * PurchasesTable.tsx.
 *
 * Es un componente de PRESENTACION PURA: no decide "activo/inactivo" ni
 * ninguna otra logica de negocio — solo recibe un `variant` ya resuelto por
 * quien lo usa. Esa decision (por ejemplo, `active ? 'secondary' : 'muted'`)
 * sigue viviendo en cada wrapper de modulo (`ProductStatusBadge`, etc.),
 * exactamente como ya lo documenta `FRONTEND_ARCHITECTURE.md` para el resto
 * de los componentes compartidos (`Can`, `DataTable`).
 *
 * Vive en `components/common/`, no en `components/ui/`, siguiendo
 * exactamente donde ya vive el otro componente compartido cross-modulo del
 * proyecto (`components/common/Can.tsx`) — no se crea ninguna carpeta nueva.
 *
 * Los 4 tokens de marca agregados en la Etapa 5.4 (`brand`, `accent-amber`,
 * `accent-teal`) no se incorporan como variante todavia: ningun badge real
 * del proyecto los usa hoy. Agregarlos ahora seria inventar un uso que no
 * existe — se agregan en el momento en que un caso real los necesite, mismo
 * criterio que ya se aplico con `Sheet`/`Skeleton` en el resto de la Etapa 5.
 */

export type BadgeVariant = 'secondary' | 'muted' | 'accent' | 'destructive'

interface BadgeProps {
  /** Combinacion de color. Por defecto `secondary` (el caso "activo" ya
   * usado hoy en los 6 badges de estado). */
  variant?: BadgeVariant
  /** Clases adicionales, se combinan con las del variant (no las reemplazan). */
  className?: string
  children: ReactNode
}

const VARIANT_CLASSNAMES: Record<BadgeVariant, string> = {
  secondary: 'bg-secondary text-secondary-foreground',
  muted: 'bg-muted text-muted-foreground',
  accent: 'bg-accent text-accent-foreground',
  destructive: 'bg-destructive/10 text-destructive',
}

export function Badge({ variant = 'secondary', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        VARIANT_CLASSNAMES[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}