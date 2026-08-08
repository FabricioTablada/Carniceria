import type { ComponentType, ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FormSectionProps {
  /** Icono de la seccion, en `text-brand` junto al titulo — mismo patron
   * de "icono + titulo" ya usado en `DashboardPage.tsx` ("Acciones
   * rápidas", etc.) y en el resumen de Compras (`PurchaseSummary.tsx`). */
  icon: ComponentType<{ className?: string }>
  title: string
  /** Texto breve opcional bajo el titulo, solo cuando aporta contexto
   * real (ej. "Cómo se organiza y tributa este producto") — por defecto
   * `undefined`, sin el `CardDescription` no cambia nada de lo que ya
   * renderizaban los 10 modulos que usan `FormSection` hoy. */
  description?: string
  /** Contenido opcional alineado a la derecha del título (ej. una acción o
   * un indicador de estado) — aditivo, mismo criterio que `stickyHeader`
   * en `DataTable.tsx` o `size="xs"` en `KpiCard.tsx`: por defecto
   * `undefined`, no cambia nada de lo que ya renderizan los módulos que
   * usan `FormSection` hoy. Primer consumidor: `PurchaseHeaderFields.tsx`
   * (rediseño de Compras), progresión visual de estado. */
  headerAction?: ReactNode
  children: ReactNode
}

/**
 * components/ui/FormSection.tsx
 * -----------------------------------------------------------------------------
 * Agrupa un conjunto de campos relacionados dentro de una `Card` con
 * encabezado (icono + titulo) — el estandar visual aprobado para los
 * formularios de creacion/edicion del sistema (primer prototipo en
 * `features/products/components/ProductForm.tsx`, luego replicado en el
 * resto de modulos). Antes de extraerse aca, este mismo markup
 * (`Card`/`CardHeader`/`CardTitle`/`CardContent` + icono) estaba definido
 * como una funcion local (`SectionHeader`) dentro de `ProductForm.tsx`;
 * se saca a un componente compartido para que ningun otro modulo tenga
 * que redefinirlo.
 *
 * Sin logica de formulario: no sabe nada de `register`/`Controller`/
 * validacion — cada modulo sigue siendo dueño de sus propios campos,
 * este componente solo aporta el contenedor visual (icono + titulo +
 * tarjeta) alrededor de `children`.
 */
export function FormSection({ icon: Icon, title, description, headerAction, children }: FormSectionProps) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardHeader className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 text-brand" />
            {title}
          </CardTitle>
          {headerAction}
        </div>
        {description && <CardDescription className="pl-6">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5 p-5 pt-2">
        {children}
      </CardContent>
    </Card>
  )
}
