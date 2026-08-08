import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { SalesByDateFilters, SalesByDateItem } from '../types/report.types'

export function useSalesByDate(filters?: SalesByDateFilters) {
  return useQuery<SalesByDateItem[], AxiosError>({
    queryKey: ['reports', 'sales-by-date', filters],
    queryFn: () => reportsApi.getSalesByDate(filters),
  })
}
