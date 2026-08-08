import { useMemo } from 'react'
import type { AxiosError } from 'axios'
import { usePurchasesWindow } from './usePurchasesWindow'

/**
 * features/purchases/hooks/useProductWasteHistory.ts
 * -----------------------------------------------------------------------------
 * Bloque COST-06.5: junta el `expectedWastePercent` (no nulo) de todas las
 * lineas de compra historicas de un producto, como insumo de
 * `analyzeWasteHistory` (`wasteHistoryAnalysis.ts`).
 *
 * Rediseño de Compras: la consulta en si (`GET /purchases?limit=100`) se
 * extrajo a `usePurchasesWindow.ts` — `useProductLastPurchase.ts` necesita
 * exactamente la misma ventana de datos para derivar costo/proveedor mas
 * recientes, y TanStack Query solo comparte cache entre dos `useQuery` con
 * el MISMO `queryKey`. Sin este cambio, ambos hooks dispararian su propio
 * `GET /purchases` por separado. El contrato de salida (arreglo de
 * porcentajes) no cambia.
 *
 * Limitacion conocida y deliberada (documentada tambien en
 * `usePurchasesWindow.ts`): sin filtro `productId` en el backend, es la
 * ventana de las 100 compras mas recientes de la sucursal, no el historial
 * completo.
 */
export function useProductWasteHistory(productId: string) {
  const { data, isLoading, error } = usePurchasesWindow()

  const wastePercents = useMemo(() => {
    if (!data) {
      return undefined
    }

    return data
      .flatMap((purchase) => purchase.items)
      .filter((item) => item.productId === productId && item.expectedWastePercent !== null)
      .map((item) => item.expectedWastePercent as number)
  }, [data, productId])

  return {
    data: productId ? wastePercents : undefined,
    isLoading: productId ? isLoading : false,
    error: error as AxiosError | null,
  }
}
