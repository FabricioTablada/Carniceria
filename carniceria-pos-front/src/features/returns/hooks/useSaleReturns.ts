import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { returnsApi } from '../api/returns.api'
import type { PaginatedSaleReturnsResponse } from '../types/return.types'

/**
 * features/returns/hooks/useSaleReturns.ts
 * -----------------------------------------------------------------------------
 * Bloque 4.4 ("hacer visibles las devoluciones ya registradas"). Reutiliza
 * el endpoint `GET /returns` ya construido en el Bloque 4.2 (filtrado por
 * `saleId`) — mismo criterio que `useSales`/`useCashReport`: un hook por
 * listado, sin logica nueva de fetching.
 */
export function useSaleReturns(saleId: string) {
  return useQuery<PaginatedSaleReturnsResponse, AxiosError>({
    queryKey: ['returns', 'list', { saleId }],
    queryFn: () => returnsApi.getReturns({ saleId, limit: 100 }),
    enabled: Boolean(saleId),
  })
}
