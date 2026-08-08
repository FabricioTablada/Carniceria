import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { salesApi } from '@/features/sales/api/sales.api'

export interface ProductLastSaleInfo {
  saleDate: string
  quantity: number
  unitPrice: number
}

/**
 * features/products/hooks/useProductLastSale.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Productos — Drawer como panel de contexto: "última venta" de
 * este producto. Mismo criterio que `useProductLastPurchase.ts` (Compras):
 * `GET /sales` no acepta un filtro `productId` (`SaleFilters` no lo tiene),
 * así que se trae una ventana de las 100 ventas más recientes de la
 * sucursal (`limit: 100`, orden por defecto del backend) y se filtra en el
 * cliente por `item.productId` — no es el historial completo, es la
 * ventana de ventas más recientes, misma limitación ya documentada para el
 * caso equivalente de Compras.
 */
export function useProductLastSale(productId: string) {
  const { data, isLoading } = useQuery<
    { saleDate: string; items: { productId: string; quantity: number; unitPrice: number }[] }[],
    AxiosError
  >({
    queryKey: ['sales', 'recentWindow'],
    queryFn: async () => {
      const response = await salesApi.getSales({ limit: 100 })
      return response.data.map((sale) => ({ saleDate: sale.saleDate, items: sale.items }))
    },
  })

  const info = useMemo<ProductLastSaleInfo | null>(() => {
    if (!data || !productId) {
      return null
    }

    const matches = data
      .flatMap((sale) =>
        sale.items
          .filter((item) => item.productId === productId)
          .map((item) => ({ saleDate: sale.saleDate, quantity: item.quantity, unitPrice: item.unitPrice })),
      )
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())

    return matches[0] ?? null
  }, [data, productId])

  return { data: info, isLoading: productId ? isLoading : false }
}
