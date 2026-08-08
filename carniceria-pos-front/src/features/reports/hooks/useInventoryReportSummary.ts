import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { InventoryReportFilters, InventoryReportSummary } from '../types/report.types'

/** Mismo criterio que `useSalesReportSummary.ts`/`usePurchasesReportSummary.ts`/
 * `useProfitReportSummary.ts`. */
export function useInventoryReportSummary(
  filters?: Omit<InventoryReportFilters, 'page' | 'limit'>,
) {
  return useQuery<InventoryReportSummary, AxiosError>({
    queryKey: ['reports', 'inventory', 'summary', filters],
    queryFn: () => reportsApi.getInventoryReportSummary(filters),
  })
}
