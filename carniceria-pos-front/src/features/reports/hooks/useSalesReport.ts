import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type {
  PaginatedSalesReportResponse,
  SalesReportFilters,
} from '../types/report.types'

export function useSalesReport(filters?: SalesReportFilters) {
  return useQuery<PaginatedSalesReportResponse, AxiosError>({
    queryKey: ['reports', 'sales', filters],
    queryFn: () => reportsApi.getSalesReport(filters),
  })
}