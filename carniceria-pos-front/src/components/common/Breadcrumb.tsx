import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  /** Ausente en el ultimo item (la pagina actual, no un link). */
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

/**
 * components/common/Breadcrumb.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 2: primitivo generico y reutilizable —
 * reemplaza el "← Volver a compras" ad-hoc que hoy solo tiene
 * `PurchasesPage`/`EditPurchaseForm.tsx`, con el mismo caso de uso
 * (orientar al usuario en pantallas a mas de un nivel de profundidad) pero
 * util en cualquier profundidad, no solo "un nivel atras". No reemplaza
 * ese boton todavia (fuera del alcance de este bloque, que es
 * exclusivamente Productos) — queda disponible para cuando le toque a
 * Compras.
 *
 * Solo colores/tipografia de `index.css` (`text-muted-foreground`/
 * `text-foreground`, ya existentes) — ningun token nuevo. El ultimo item
 * (pagina actual) nunca es un link, sin importar si trae `href`.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            )}
            {isLast || !item.href ? (
              <span className={isLast ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
