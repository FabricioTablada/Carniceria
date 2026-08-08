import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { CashReportFilters, CashReportSummary } from '../types/report.types'

/** Mismo criterio que `useSalesReportSummary.ts`/`usePurchasesReportSummary.ts`/
 * `useProfitReportSummary.ts`/`useInventoryReportSummary.ts`. */
export function useCashReportSummary(filters?: Omit<CashReportFilters, 'page' | 'limit'>) {
  return useQuery<CashReportSummary, AxiosError>({
    queryKey: ['reports', 'cash', 'summary', filters],
    queryFn: () => reportsApi.getCashReportSummary(filters),
  })
}
