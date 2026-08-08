import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { LowStockFilters, LowStockItem } from '../types/report.types'

export function useLowStock(filters?: LowStockFilters) {
  return useQuery<LowStockItem[], AxiosError>({
    queryKey: ['reports', 'low-stock', filters],
    queryFn: () => reportsApi.getLowStock(filters),
  })
}