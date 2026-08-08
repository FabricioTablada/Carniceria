import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * components/common/KpiCard.tsx
 * -----------------------------------------------------------------------------
 * Extrae la unica implementacion real de tarjeta de metrica del proyecto:
 * `DashboardSummaryCards.tsx` (la unica encontrada — verificado, ningun
 * otro archivo tiene este patron; el resto de los usos de `Card` son
 * paneles genericos con titulo de texto, no indicadores numericos).
 *
 * Presentacion pura: representa UNA tarjeta, no la grilla completa. Quien
 * la usa sigue decidiendo el layout de la grilla y el orden/contenido de
 * las metricas (mismo criterio de responsabilidad que `Badge.tsx`/
 * `PageHeader.tsx`: este componente no organiza datos, solo presenta uno).
 *
 * `value` acepta `string | number` porque asi es como ya se usa hoy: las
 * metricas de conteo pasan un numero crudo, y las metricas monetarias ya
 * llegan formateadas por `formatCurrency` antes de esta tarjeta — este
 * componente no formatea nada, solo muestra lo que recibe.
 *
 * `icon` es opcional (identidad visual v2 del Dashboard): un `LucideIcon`
 * ya resuelto por quien usa la tarjeta (mismos iconos que ya existen en
 * `navigation.ts`/el resto del POS, ninguno nuevo se inventa aca). Sigue
 * sin indicador de tendencia (flecha arriba/abajo): eso no existe en la
 * implementacion real todavia.
 *
 * `size` (rediseño del Dashboard, opcional, `'default'` por defecto —
 * comportamiento identico al que ya existia antes de agregar esta prop):
 * `'compact'` es una variante mas chica/discreta para las metricas
 * administrativas de menor protagonismo (Productos, Categorias,
 * Proveedores, Usuarios, Compras, Importe comprado en
 * `DashboardSummaryCards.tsx`) — mismo componente, solo menos padding y
 * tipografia mas chica.
 *
 * Bloque 11.1 (refinamiento de Ventas): `'xs'` — un escalon mas chico que
 * `'compact'`, para grillas densas de "informacion general" tipo factura
 * (primer uso: `SaleDetailContent.tsx`) donde 8-9 tarjetas comparten
 * espacio con una tabla que debe ser el foco principal. Aditivo: no
 * cambia nada para los consumidores existentes de `'default'`/`'compact'`
 * (Dashboard, `ProductsKpiRow.tsx`) — pensado para reutilizarse en
 * cualquier otro modulo administrativo con la misma necesidad (Compras,
 * Caja, Movimientos).
 */

interface KpiCardProps {
  /** Rediseño de Workspace de Productos (aprobado): ensanchado de
   * `string` a `ReactNode` — cambio compatible (un `string` sigue siendo
   * un `ReactNode` valido) para que "Categorías" (`ProductsKpiRow.tsx`)
   * pueda incluir un icono de salida junto al texto sin agregar un prop
   * nuevo solo para eso. Ningun consumidor existente cambia. */
  label: ReactNode
  /** Bloque 7 (pulido final): ensanchado de `string | number` a
   * `ReactNode` — cambio compatible (ambos siguen siendo `ReactNode`
   * validos) para que un consumidor pueda pasar un `Skeleton` mientras
   * su valor real todavia esta cargando (primer caso: `ProductsKpiRow.tsx`).
   * `DashboardSummaryCards.tsx` sigue pasando `string | number` tal cual,
   * sin cambios. */
  value: ReactNode
  icon?: LucideIcon
  className?: string
  size?: 'default' | 'compact' | 'xs'
  /** Bloque POS-07 ("Resumen de mi sesión"): linea corta opcional debajo
   * del valor (ej. "Cantidad de ventas") — aditivo y por defecto ausente,
   * ningun consumidor existente (`DashboardSummaryCards.tsx`,
   * `CashSessionDetailPage.tsx`, `SaleDetailContent.tsx`) cambia si no la
   * pasa. Primer uso: el panel "Resumen de mi sesión" del POS, donde
   * aporta jerarquia visual sin agregar un componente nuevo. */
  description?: ReactNode
  /** Bloque Final (auditoria/pulido): color semantico opcional del
   * icono/fondo — por defecto `'brand'`, identico al comportamiento
   * anterior a esta prop (`bg-brand/10 text-brand ring-brand/15`), asi
   * que ningun consumidor existente (`DashboardSummaryCards.tsx`) cambia
   * si no la usa. `'success'`/`'muted'` permiten que una metrica de
   * salud (ej. "Activos" vs "Inactivos") se lea de un vistazo sin tener
   * que leer la etiqueta — primer uso en `ProductsKpiRow.tsx`. */
  tone?: 'brand' | 'success' | 'muted'
  /** Rediseño de Workspace de Productos (aprobado): variante sin `Card`
   * propio (sin borde/sombra/hover-lift) para embeberse dentro de una
   * franja compartida con otras celdas (ej. una fila de KPIs dividida por
   * `divide-x` dentro de un Workspace unico) sin duplicar bordes. `false`
   * por defecto — ningun consumidor existente (`DashboardSummaryCards.tsx`,
   * `SaleDetailContent.tsx`, `CashSessionDetailPage.tsx`) cambia si no lo
   * pasa. */
  bare?: boolean
}

const TONE_CLASSNAMES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  brand: 'bg-brand/10 text-brand ring-brand/15',
  success: 'bg-success/10 text-success ring-success/15',
  muted: 'bg-muted text-muted-foreground ring-border',
}

// Bloque 7: el numero se envuelve en <div>, no <p> — desde que `value`
// acepta ReactNode (arriba), un consumidor puede pasar contenido de
// bloque (ej. `Skeleton`, un <div> de animate-pulse) y un <div> dentro de
// un <p> es HTML invalido (error de hidratacion en consola, confirmado
// en el navegador antes de este fix). Cero diferencia visual: <p> no
// aportaba ningun estilo tipografico propio aca, todo viene de las
// clases.

const SIZE_CONTENT_CLASSNAMES: Record<NonNullable<KpiCardProps['size']>, string> = {
  default: 'gap-6 p-6',
  compact: 'gap-3 p-4',
  xs: 'gap-1.5 p-3',
}

const SIZE_LABEL_CLASSNAMES: Record<NonNullable<KpiCardProps['size']>, string> = {
  default: 'text-base',
  compact: 'text-xs text-muted-foreground',
  xs: 'text-[0.6875rem] text-muted-foreground',
}

const SIZE_ICON_WRAPPER_CLASSNAMES: Record<NonNullable<KpiCardProps['size']>, string> = {
  default: 'size-9',
  compact: 'size-7',
  xs: 'size-6',
}

const SIZE_ICON_CLASSNAMES: Record<NonNullable<KpiCardProps['size']>, string> = {
  default: 'size-[1.125rem]',
  compact: 'size-3.5',
  xs: 'size-3',
}

const SIZE_VALUE_CLASSNAMES: Record<NonNullable<KpiCardProps['size']>, string> = {
  default: 'text-[1.75rem]',
  compact: 'text-lg',
  xs: 'text-sm',
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  className,
  size = 'default',
  tone = 'brand',
  description,
  bare = false,
}: KpiCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={cn('font-semibold text-foreground', SIZE_LABEL_CLASSNAMES[size])}>
          {label}
        </span>
        {Icon && (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg ring-1',
              TONE_CLASSNAMES[tone],
              SIZE_ICON_WRAPPER_CLASSNAMES[size],
            )}
          >
            <Icon className={SIZE_ICON_CLASSNAMES[size]} />
          </div>
        )}
      </div>

      <div className={cn('leading-none font-bold tracking-tight', SIZE_VALUE_CLASSNAMES[size])}>
        {value}
      </div>

      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </>
  )

  if (bare) {
    return (
      <div className={cn('flex flex-col', SIZE_CONTENT_CLASSNAMES[size], className)}>
        {content}
      </div>
    )
  }

  return (
    <Card
      className={cn(
        'gap-0 border-border/60 p-0 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-md',
        className,
      )}
    >
      <CardContent className={cn('flex flex-col', SIZE_CONTENT_CLASSNAMES[size])}>
        {content}
      </CardContent>
    </Card>
  )
}