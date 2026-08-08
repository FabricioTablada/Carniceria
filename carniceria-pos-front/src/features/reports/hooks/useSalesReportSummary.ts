import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { SalesReportFilters, SalesReportSummary } from '../types/report.types'

/**
 * features/reports/hooks/useSalesReportSummary.ts
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-AGREGADOS: hook independiente de `useSalesReport`
 * (paginado) — mismo criterio de query key (`['reports', 'sales', ...]`)
 * para que ambos invaliden juntos (`invalidateQueries({queryKey:
 * ['reports']})`, ya usado en el resto del proyecto), pero cada uno con
 * su propio `queryFn`: no se puede derivar el agregado del listado
 * paginado (esa pagina no tiene el conjunto completo).
 */
export function useSalesReportSummary(filters?: Omit<SalesReportFilters, 'page' | 'limit'>) {
  return useQuery<SalesReportSummary, AxiosError>({
    queryKey: ['reports', 'sales', 'summary', filters],
    queryFn: () => reportsApi.getSalesReportSummary(filters),
  })
}
