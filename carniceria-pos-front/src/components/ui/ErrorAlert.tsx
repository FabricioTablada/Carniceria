import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * components/ui/ErrorAlert.tsx
 * -----------------------------------------------------------------------------
 * Componente base para el mensaje de error que hoy aparece repetido, con la
 * misma estructura y las mismas clases, en 35 archivos del proyecto (paginas
 * de listado, paginas de edicion y algunos formularios como LoginForm y
 * OpenCashSessionForm). No agrega ninguna variante ni comportamiento nuevo:
 * es exactamente el mismo `<div role="alert">` que ya existia, solo que
 * definido una vez.
 *
 * Sin logica de dominio: no sabe nada de productos, ventas, etc. Cada punto
 * de uso sigue decidiendo su propio mensaje por defecto
 * (`error?.message ?? '...'`) y sigue decidiendo cuando mostrarlo
 * (`{isError && <ErrorAlert>...</ErrorAlert>}`).
 */
export function ErrorAlert({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      data-slot="error-alert"
      className={cn(
        'rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
      {...props}
    />
  )
}