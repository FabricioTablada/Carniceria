import { Star } from 'lucide-react'
import { Skeleton } from '@/components/common/Skeleton'
import { useTaxes } from '../hooks/useTaxes'

/**
 * features/taxes/components/TaxDefaultHero.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Impuestos (aprobado): hace evidente CUÁL es el impuesto por
 * defecto sin tener que buscarlo en la tabla — reutiliza exactamente el
 * mismo hook/filtro que ya usa `TaxesKpiRow.tsx` (`useTaxes({ isDefault:
 * true, limit: 1 })`), solo que aquí se muestra el registro completo
 * (nombre + tasa) en vez de únicamente el conteo. Ninguna consulta nueva:
 * React Query sirve esta llamada desde la misma cache que ya usa el KPI.
 *
 * Workspace Impuestos (aprobado, "un poco más de presencia, pero una
 * sola línea, como un aviso del sistema, no una tarjeta"): deja de ser
 * una tarjeta flotante propia (`rounded-xl border bg-brand/5 p-4`, con
 * sombra/borde independientes) y pasa a ser una franja delgada DENTRO del
 * Workspace único de `TaxesPage.tsx` (separada solo por `border-b`, sin
 * radio ni sombra propios — el Workspace ya los aporta). Sigue siendo el
 * mismo contenido: ícono ⭐, "Impuesto por defecto", nombre, tasa
 * alineada completamente a la derecha (ahora con más peso tipográfico —
 * `text-base font-bold` en vez de `text-2xl` dentro de una tarjeta grande
 * — para que se sienta como un dato relevante sin volver a ser un
 * protagonista visual de tarjeta propia).
 *
 * Si no hay ningún impuesto marcado como predeterminado (catálogo nuevo,
 * o el único default fue desactivado/eliminado), no se renderiza nada —
 * degradación silenciosa, mismo criterio que el resto de indicadores
 * opcionales del proyecto (ej. `CategoryLowStockIndicator.tsx`).
 *
 * QA.8 (Impuestos): el filtro `active: true` se agregó junto con
 * `isDefault: true` — sin él, un impuesto marcado como predeterminado que
 * luego se desactiva (el backend no lo impide) seguía apareciendo aca
 * como si siguiera siendo un default utilizable, contradiciendo el
 * parrafo de arriba (que ya documentaba esta franja como "no se
 * renderiza nada" en ese caso exacto). Mismo hallazgo/mismo fix en
 * `CreateProductPage.tsx` (el mismo dato causaba ademas que el
 * formulario de producto preseleccionara un impuesto inactivo, ausente
 * de su propio selector) y `TaxesKpiRow.tsx` ("Por defecto").
 */
export function TaxDefaultHero() {
  const { data, isLoading } = useTaxes({ isDefault: true, active: true, limit: 1 })
  const defaultTax = data?.data[0]

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 bg-brand/5 px-4 py-2.5">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <Skeleton className="h-3.5 w-56" />
        <Skeleton className="ml-auto h-4 w-12" />
      </div>
    )
  }

  if (!defaultTax) {
    return null
  }

  return (
    <div className="flex items-center gap-2.5 bg-brand/5 px-4 py-2.5 text-sm">
      <Star className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="text-muted-foreground">Impuesto por defecto:</span>
      <span className="truncate font-semibold text-foreground">{defaultTax.name}</span>
      <span className="ml-auto shrink-0 text-base font-bold tabular-nums text-brand">
        {defaultTax.rate}%
      </span>
    </div>
  )
}
