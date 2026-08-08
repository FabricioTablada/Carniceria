import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { purchasesApi } from '../api/purchases.api'

export interface SupplierPurchaseStats {
  /** Total real de compras del proveedor (`meta.total`, no limitado por la
   * ventana de 100 filas que se trae para calcular el resto de las
   * metricas). */
  totalPurchases: number
  lastPurchaseDate: string | null
  averageAmount: number
  /** Hasta 5 nombres de producto distintos, de las lineas mas recientes. */
  recentProducts: string[]
}

/**
 * features/purchases/hooks/useSupplierPurchaseStats.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — contexto del proveedor ("ultima compra", "monto
 * promedio", "cantidad de compras", "productos comprados recientemente"),
 * derivado de `GET /purchases?supplierId=X`, un filtro que YA EXISTE en el
 * backend (`ListPurchasesFilters.supplierId`) — a diferencia de `productId`
 * (`useProductWasteHistory.ts`), este si es un filtro real del servidor, no
 * un filtrado client-side sobre una ventana sin filtrar.
 *
 * Deliberadamente NO incluye "tiempo promedio de entrega": `Purchase` solo
 * tiene una fecha de negocio (`purchaseDate`), sin un par
 * orden-enviada/orden-recibida que permita calcular un lead time real — mostrar
 * un numero ahi seria inventar un dato que el backend no tiene. Ver el
 * hallazgo correspondiente en el resumen tecnico de este bloque.
 *
 * `limit: 100`: mismo "techo real de una sola pagina" ya documentado en
 * `usePurchasesWindow.ts` — `averageAmount`/`recentProducts` se calculan
 * sobre esa ventana (compras mas recientes del proveedor), no sobre el
 * historico completo; `totalPurchases` si es exacto porque viene de
 * `meta.total`, no de `data.length`.
 */
export function useSupplierPurchaseStats(supplierId: string | null) {
  return useQuery<SupplierPurchaseStats, AxiosError>({
    queryKey: ['purchases', 'supplierStats', supplierId],
    queryFn: async () => {
      const response = await purchasesApi.getPurchases({ supplierId: supplierId ?? undefined, limit: 100 })
      const purchases = response.data

      const sorted = [...purchases].sort(
        (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
      )

      const averageAmount =
        purchases.length > 0
          ? purchases.reduce((sum, purchase) => sum + purchase.total, 0) / purchases.length
          : 0

      const recentProducts: string[] = []
      for (const purchase of sorted) {
        for (const item of purchase.items) {
          if (!recentProducts.includes(item.product.name)) {
            recentProducts.push(item.product.name)
          }
          if (recentProducts.length >= 5) {
            break
          }
        }
        if (recentProducts.length >= 5) {
          break
        }
      }

      return {
        totalPurchases: response.meta.total,
        lastPurchaseDate: sorted[0]?.purchaseDate ?? null,
        averageAmount,
        recentProducts,
      }
    },
    enabled: Boolean(supplierId),
  })
}
