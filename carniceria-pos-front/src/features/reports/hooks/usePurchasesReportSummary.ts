import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { PurchasesReportFilters, PurchasesReportSummary } from '../types/report.types'

/** Mismo criterio que `useSalesReportSummary.ts`. */
export function usePurchasesReportSummary(
  filters?: Omit<PurchasesReportFilters, 'page' | 'limit'>,
) {
  return useQuery<PurchasesReportSummary, AxiosError>({
    queryKey: ['reports', 'purchases', 'summary', filters],
    queryFn: () => reportsApi.getPurchasesReportSummary(filters),
  })
}
