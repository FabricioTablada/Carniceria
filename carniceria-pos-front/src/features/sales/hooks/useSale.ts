import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { salesApi } from '../api/sales.api'
import type { Sale } from '../types/sale.types'

export function useSale(id: string) {
  return useQuery<Sale, AxiosError>({
    queryKey: ['sales', 'detail', id],
    queryFn: () => salesApi.getSaleById(id),
    enabled: Boolean(id),
  })
}