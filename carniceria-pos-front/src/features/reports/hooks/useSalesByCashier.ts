import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type {
  SalesByCashierFilters,
  SalesByCashierItem,
} from '../types/report.types'

export function useSalesByCashier(filters?: SalesByCashierFilters) {
  return useQuery<SalesByCashierItem[], AxiosError>({
    queryKey: ['reports', 'sales-by-cashier', filters],
    queryFn: () => reportsApi.getSalesByCashier(filters),
  })
}