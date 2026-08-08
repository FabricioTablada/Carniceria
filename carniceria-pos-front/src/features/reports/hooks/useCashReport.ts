import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type {
  CashReportFilters,
  PaginatedCashReportResponse,
} from '../types/report.types'

export function useCashReport(filters?: CashReportFilters) {
  return useQuery<PaginatedCashReportResponse, AxiosError>({
    queryKey: ['reports', 'cash', filters],
    queryFn: () => reportsApi.getCashReport(filters),
  })
}