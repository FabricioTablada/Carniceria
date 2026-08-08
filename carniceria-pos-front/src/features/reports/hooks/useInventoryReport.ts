import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type {
  InventoryReportFilters,
  PaginatedInventoryReportResponse,
} from '../types/report.types'

export function useInventoryReport(filters?: InventoryReportFilters) {
  return useQuery<PaginatedInventoryReportResponse, AxiosError>({
    queryKey: ['reports', 'inventory', filters],
    queryFn: () => reportsApi.getInventoryReport(filters),
  })
}