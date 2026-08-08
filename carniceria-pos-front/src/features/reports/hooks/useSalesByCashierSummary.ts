import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { SalesByCashierFilters, SalesByCashierSummary } from '../types/report.types'

/** Mismo criterio que `useCashReportSummary.ts`/`useProfitReportSummary.ts`/
 * `useInventoryReportSummary.ts`/`usePurchasesReportSummary.ts`. Sin
 * `Omit<..., 'page' | 'limit'>`: `SalesByCashierFilters` nunca tuvo esos
 * campos (este reporte nunca fue paginado). */
export function useSalesByCashierSummary(filters?: SalesByCashierFilters) {
  return useQuery<SalesByCashierSummary, AxiosError>({
    queryKey: ['reports', 'sales-by-cashier', 'summary', filters],
    queryFn: () => reportsApi.getSalesByCashierSummary(filters),
  })
}
