import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { ProfitReportFilters, ProfitReportSummary } from '../types/report.types'

/** Mismo criterio que `useSalesReportSummary.ts`/`usePurchasesReportSummary.ts`. */
export function useProfitReportSummary(filters?: Omit<ProfitReportFilters, 'page' | 'limit'>) {
  return useQuery<ProfitReportSummary, AxiosError>({
    queryKey: ['reports', 'profit', 'summary', filters],
    queryFn: () => reportsApi.getProfitReportSummary(filters),
  })
}
