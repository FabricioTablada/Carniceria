import { Badge } from './Badge'

/**
 * components/common/ActiveStatusBadge.tsx
 * -----------------------------------------------------------------------------
 * Unifica la logica que hoy esta duplicada, byte a byte, en 6 wrappers de
 * modulo (ProductStatusBadge, UserStatusBadge, CategoryStatusBadge,
 * TaxStatusBadge, SupplierStatusBadge, RoleStatusBadge): mismo variant
 * (`active ? 'secondary' : 'muted'`) y mismo texto (`'Activo'`/`'Inactivo'`).
 *
 * Esos 6 wrappers siguen existiendo — no se tocan sus consumidores ni sus
 * nombres publicos — pero ahora delegan aqui en vez de repetir la logica.
 *
 * Presentacion (estandarizacion visual, alcance modulos administrativos):
 * ancho fijo + texto centrado, mismo criterio ya aplicado a los badges de
 * estado de Ventas — evita que la columna "Estado" se vea dentada cuando
 * conviven "Activo"/"Inactivo" (largos distintos). Punto de color
 * (`bg-current`) en vez de pastilla solida: se lee mas rapido, mismo
 * lenguaje visual que el resto del sistema ya rediseñado.
 */
interface ActiveStatusBadgeProps {
  active: boolean
}

export function ActiveStatusBadge({ active }: ActiveStatusBadgeProps) {
  return (
    <Badge
      variant={active ? 'secondary' : 'muted'}
      className="w-20 min-w-20 justify-center gap-1.5 py-1"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {active ? 'Activo' : 'Inactivo'}
    </Badge>
  )
}