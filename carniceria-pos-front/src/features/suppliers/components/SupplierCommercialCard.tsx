import { Wallet } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { KpiCard } from '@/components/common/KpiCard'
import { usePurchasesReportSummary } from '@/features/reports/hooks/usePurchasesReportSummary'
import { useSupplierPurchaseStats } from '@/features/purchases/hooks/useSupplierPurchaseStats'
import { formatPurchaseDate } from '@/features/purchases/utils/purchase.utils'
import { usePromotions } from '@/features/promotions/hooks/usePromotions'
import { formatCurrency } from '@/utils/formatCurrency'

interface SupplierCommercialCardProps {
  supplierId: string
}

/**
 * features/suppliers/components/SupplierCommercialCard.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Proveedores (aprobado): tarjeta comercial compacta del
 * Drawer — total comprado, última compra, promedio por compra, productos
 * distintos comprados y promociones patrocinadas activas. NINGÚN cálculo
 * nuevo: cada valor viene de un hook ya construido en otro bloque.
 *
 *  - `usePurchasesReportSummary({ supplierId })` (Reportes, ya soporta
 *    `supplierId`): `totalAmount` ("Total comprado") y `averageTicket`
 *    ("Promedio por compra") — totales sobre el histórico COMPLETO
 *    filtrado, no sobre una ventana.
 *  - `useSupplierPurchaseStats(supplierId)` (Compras, ya construido para
 *    `PurchaseSupplierContextPanel.tsx`): `lastPurchaseDate` y
 *    `recentProducts` — mismo hook, misma query cacheada por React Query
 *    (no se duplica la petición aunque el Drawer también use el panel
 *    completo). "Productos distintos" usa `recentProducts.length`, que el
 *    propio hook documenta como "hasta 5" — se muestra con un "+" cuando
 *    llega a ese techo, para no insinuar una cifra exacta que no es.
 *  - `usePromotions({ active: true })` (Promociones, ya construido):
 *    `Promotion.supplierId` ya existe (Commercial Pricing Engine,
 *    PROMO-03/07) pero el backend no filtra por proveedor — se filtra en
 *    cliente sobre las promociones activas ya traídas, mismo criterio ya
 *    usado en Categorías/Impuestos para datos sin filtro de backend.
 *
 * Pulido visual aprobado (con montos reales, las 5 tarjetas iguales
 * perdían equilibrio): "Total comprado" deja de ser una `KpiCard` mas y
 * pasa a ser un bloque "hero" propio a ancho completo — mismo lenguaje
 * de caja con tinte de marca ya usado para "Tasa" en `TaxForm.tsx`
 * (`bg-brand/5 border-brand/15`), con tipografia grande
 * (`text-3xl`/`text-4xl`) y `tabular-nums`. Los otros 4 indicadores bajan
 * a una franja compacta `bare` debajo. Ningun hook, ningun calculo,
 * ninguna metrica nueva ni eliminada — solo composicion visual.
 *
 * Ronda 2 de pulido (aprobada — "acabado de produccion"):
 *  - El icono del hero baja de `size-11`/`size-5` a `size-8`/`size-4`
 *    (~27%/20%) y se mueve a la fila de la etiqueta (ya no ocupa una
 *    columna propia junto al monto) — el monto es el unico protagonista
 *    de su propia fila, a todo el ancho del bloque.
 *  - Sin `overflow-x-auto`/`whitespace-nowrap`: el monto ya no fuerza una
 *    sola linea con scroll horizontal. Con la fuente grande fija
 *    (`text-3xl`/`text-4xl`, nunca se encoge) y ahora todo el ancho del
 *    bloque disponible, un monto real cabe en una linea; si alguno
 *    excepcional no cupiera, el espacio (separador de miles de
 *    `Intl`/`es-CR`) es un punto de quiebre natural — el bloque gana
 *    altura en vez de mostrar scroll, exactamente como se pidio.
 *  - Franja inferior: se quita la caja (`border`/`rounded-lg`/fondo) que
 *    se sentia como "cuadricula" — ahora es un `grid` sin fondo propio,
 *    separado unicamente por `divide-x` sutil (`border/50`) en pantallas
 *    `sm+`; en mobile las 4 metricas se apilan en 2 columnas sin lineas,
 *    solo espaciado, para un aspecto mas limpio.
 */
export function SupplierCommercialCard({ supplierId }: SupplierCommercialCardProps) {
  const { data: purchasesSummary, isLoading: isSummaryLoading } = usePurchasesReportSummary({
    supplierId,
  })
  const { data: stats, isLoading: isStatsLoading } = useSupplierPurchaseStats(supplierId)
  const { data: promotionsResponse, isLoading: isPromotionsLoading } = usePromotions({
    active: true,
  })

  const sponsoredPromotions = (promotionsResponse?.data ?? []).filter(
    (promotion) => promotion.supplierId === supplierId,
  )
  const isPurchaseDataLoading = isSummaryLoading || isStatsLoading
  const distinctProductsCount = stats?.recentProducts.length ?? 0

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Resumen comercial
      </h3>
      <div className="flex flex-col gap-2">
        {/* Total comprado — bloque hero a ancho completo, ver doc arriba. */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-brand/15 bg-brand/5 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
              <Wallet className="size-4" />
            </div>
            <span className="text-xs font-semibold tracking-wide text-brand/80 uppercase">
              Total comprado
            </span>
          </div>
          <div className="text-3xl leading-tight font-bold tracking-tight text-brand tabular-nums sm:text-4xl">
            {isPurchaseDataLoading ? '—' : formatCurrency(purchasesSummary?.totalAmount ?? 0)}
          </div>
        </div>

        {/* Resto de indicadores — franja compacta, sin caja de "cuadricula"
            propia, separada por divisores sutiles (ver doc arriba). */}
        <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-border/50">
          <KpiCard
            bare
            label="Última compra"
            value={
              isPurchaseDataLoading
                ? '—'
                : stats?.lastPurchaseDate
                  ? formatPurchaseDate(stats.lastPurchaseDate)
                  : '—'
            }
            size="xs"
          />
          <KpiCard
            bare
            label="Promedio por compra"
            value={isPurchaseDataLoading ? '—' : formatCurrency(purchasesSummary?.averageTicket ?? 0)}
            size="xs"
          />
          <KpiCard
            bare
            label="Productos distintos"
            value={isPurchaseDataLoading ? '—' : `${distinctProductsCount}${distinctProductsCount === 5 ? '+' : ''}`}
            size="xs"
          />
          <KpiCard
            bare
            label="Promociones patrocinadas"
            value={isPromotionsLoading ? '—' : sponsoredPromotions.length}
            size="xs"
          />
        </div>
      </div>

      {sponsoredPromotions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sponsoredPromotions.map((promotion) => (
            <Badge key={promotion.id} variant="accent">
              {promotion.name}
            </Badge>
          ))}
        </div>
      )}
    </section>
  )
}
