import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { purchasesApi } from '../api/purchases.api'
import type { Purchase } from '../types/purchase.types'

/**
 * features/purchases/hooks/usePurchasesWindow.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — extrae la consulta que `useProductWasteHistory.ts`
 * (Bloque COST-06.5) ya hacía en solitario, para que un segundo consumidor
 * (`useProductLastPurchase.ts`, misma ventana de datos) no dispare una
 * segunda petición idéntica: TanStack Query cachea por `queryKey`, así que
 * ambos hooks comparten la misma respuesta sin duplicar el fetch.
 *
 * Misma limitación ya documentada en `useProductWasteHistory.ts`: `GET
 * /purchases` no acepta filtro `productId` — se trae la PRIMERA página
 * (`limit: 100`, orden por defecto: más recientes primero) y quien consuma
 * este hook filtra en el cliente. No es historial completo, es la ventana
 * de las 100 compras más recientes de la sucursal.
 */
export function usePurchasesWindow() {
  return useQuery<Purchase[], AxiosError>({
    queryKey: ['purchases', 'recentWindow'],
    queryFn: async () => {
      const response = await purchasesApi.getPurchases({ limit: 100 })

      return response.data
    },
  })
}
