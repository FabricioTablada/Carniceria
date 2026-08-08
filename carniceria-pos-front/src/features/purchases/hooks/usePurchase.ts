import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { purchasesApi } from '../api/purchases.api'
import type { Purchase } from '../types/purchase.types'

export function usePurchase(id: string) {
  return useQuery<Purchase, AxiosError>({
    queryKey: ['purchases', 'detail', id],
    queryFn: () => purchasesApi.getPurchaseById(id),
    enabled: Boolean(id),
  })
}