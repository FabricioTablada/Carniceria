import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type {
  PaginatedProfitReportResponse,
  ProfitReportFilters,
} from '../types/report.types'

export function useProfitReport(filters?: ProfitReportFilters) {
  return useQuery<PaginatedProfitReportResponse, AxiosError>({
    queryKey: ['reports', 'profit', filters],
    queryFn: () => reportsApi.getProfitReport(filters),
  })
}