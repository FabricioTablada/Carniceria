import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type {
  SalesByCategoryFilters,
  SalesByCategoryItem,
} from '../types/report.types'

export function useSalesByCategory(filters?: SalesByCategoryFilters) {
  return useQuery<SalesByCategoryItem[], AxiosError>({
    queryKey: ['reports', 'sales-by-category', filters],
    queryFn: () => reportsApi.getSalesByCategory(filters),
  })
}