import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { salesApi } from '../api/sales.api'
import type { PaginatedSalesResponse, SaleFilters } from '../types/sale.types'

export function useSales(filters?: SaleFilters, options?: { enabled?: boolean }) {
  return useQuery<PaginatedSalesResponse, AxiosError>({
    queryKey: ['sales', 'list', filters],
    queryFn: () => salesApi.getSales(filters),
    enabled: options?.enabled,
  })
}