import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type {
  PaginatedPurchasesReportResponse,
  PurchasesReportFilters,
} from '../types/report.types'

export function usePurchasesReport(filters?: PurchasesReportFilters) {
  return useQuery<PaginatedPurchasesReportResponse, AxiosError>({
    queryKey: ['reports', 'purchases', filters],
    queryFn: () => reportsApi.getPurchasesReport(filters),
  })
}