import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { purchasesApi } from '../api/purchases.api'
import type {
  PaginatedPurchasesResponse,
  PurchaseFilters,
} from '../types/purchase.types'

export function usePurchases(filters?: PurchaseFilters) {
  return useQuery<PaginatedPurchasesResponse, AxiosError>({
    queryKey: ['purchases', 'list', filters],
    queryFn: () => purchasesApi.getPurchases(filters),
  })
}