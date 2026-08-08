import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateAction {
  label: string
  onClick: () => void
  /** @default 'outline' */
  variant?: 'outline' | 'brand'
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: EmptyStateAction
  className?: string
}

/**
 * components/common/EmptyState.tsx
 * -----------------------------------------------------------------------------
 * Extraido de `features/products/components/ProductsEmptyState.tsx`
 * (Sprint UX/UI PIPASA V1, Bloque 7) al adaptar el modulo de Categorias al
 * mismo estandar — refactor puro, mismo markup/clases que tenia
 * `ProductsEmptyState`, Productos no cambia de apariencia ni de
 * comportamiento (`ProductsEmptyState.tsx` ahora delega aca en vez de
 * duplicar el JSX).
 *
 * Presentacion pura, sin logica de dominio: icono + titulo + descripcion +
 * una accion opcional (botón). Cada modulo sigue siendo dueño de decidir
 * QUE icono/texto/accion usar segun su propio estado (ej. "catalogo
 * vacio" vs "0 resultados por filtros") — este componente no sabe nada de
 * productos ni de categorias.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {action && (
        <Button
          type="button"
          variant={action.variant === 'brand' ? 'default' : 'outline'}
          size="sm"
          onClick={action.onClick}
          className={
            action.variant === 'brand'
              ? 'bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active'
              : undefined
          }
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
