import type { ReactNode } from 'react'
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'

/**
 * components/common/PageHeader.tsx
 * -----------------------------------------------------------------------------
 * Unifica el encabezado de pagina, repetido byte a byte en dos variantes
 * reales confirmadas por busqueda:
 *
 *  1. Con accion (9 paginas: products, purchases, roles, users, etc.):
 *     <div className="flex items-center justify-between">
 *       <div><h1>...</h1><p>...</p></div>
 *       <Button>Nuevo X</Button>
 *     </div>
 *
 *  2. Sin accion (10 paginas de reports, sin operacion de creacion):
 *     <div><h1>...</h1><p>...</p></div>
 *
 * Presentacion pura: `action` es un `ReactNode` opcional, no una forma fija
 * de boton — este componente no importa `Button` ni decide su variante;
 * quien lo usa sigue construyendo su propio boton exactamente como hoy,
 * este componente solo decide el layout alrededor de el (mismo criterio de
 * responsabilidad ya aplicado en `Badge.tsx`/`ErrorAlert.tsx`: la logica de
 * que accion mostrar sigue viviendo en cada pagina).
 *
 * `description` es opcional porque, aunque las 19 paginas auditadas la
 * usan hoy, no hay ninguna garantia de que toda pagina futura la necesite
 * — no se fuerza un campo vacio donde no aplique.
 *
 * Vive en `components/common/`, junto a `Can.tsx`, `Badge.tsx`,
 * `ErrorAlert.tsx` y `Skeleton.tsx` — no se crea ninguna carpeta nueva.
 *
 * Sprint UX/UI PIPASA V1, Bloque 2: `breadcrumb` es un prop OPCIONAL
 * nuevo (`BreadcrumbItem[]`, ver `Breadcrumb.tsx`) — estrictamente
 * aditivo. Sin el, el componente renderiza exactamente igual que antes
 * de este bloque; los 19 consumidores existentes que no lo pasan no
 * cambian. Este bloque solo lo usa en las 3 paginas de Productos (modulo
 * piloto) — el resto del ERP lo adopta en un bloque futuro de
 * propagacion, no en este.
 */

interface PageHeaderProps {
  title: string
  description?: string
  /** Ruta de navegacion opcional, renderizada arriba del titulo. */
  breadcrumb?: BreadcrumbItem[]
  /** Accion principal de la pagina (tipicamente un boton "Nuevo X").
   * Cuando esta presente, el encabezado usa el layout de dos columnas ya
   * usado en 9 paginas del proyecto; cuando esta ausente, usa el layout
   * simple de una sola columna ya usado en las 10 paginas de reports. */
  action?: ReactNode
}

export function PageHeader({ title, description, breadcrumb, action }: PageHeaderProps) {
  const content = (
    <div className="flex flex-col gap-1">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )

  if (!action) {
    return content
  }

  return (
    <div className="flex items-center justify-between">
      {content}
      {action}
    </div>
  )
}