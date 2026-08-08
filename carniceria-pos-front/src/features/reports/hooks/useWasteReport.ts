import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { WasteReportFilters, WasteReportResponse } from '../types/report.types'

/** Centro de Control de Inventario (aprobado): fuente real para la
 * sub-vista "Análisis" de Mermas — merma real vs. esperada por producto. */
export function useWasteReport(filters?: WasteReportFilters) {
  return useQuery<WasteReportResponse, AxiosError>({
    queryKey: ['reports', 'waste', filters],
    queryFn: () => reportsApi.getWasteReport(filters),
  })
}
