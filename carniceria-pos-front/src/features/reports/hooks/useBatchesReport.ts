import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { BatchesReportFilters, BatchesReportResponse } from '../types/report.types'

/** Centro de Control de Inventario (aprobado): fuente real de los KPIs de
 * la pestaña Lotes (conteo por estado + próximos a vencer), en vez de
 * aproximar contando filas ya cargadas en cliente. */
export function useBatchesReport(filters?: BatchesReportFilters) {
  return useQuery<BatchesReportResponse, AxiosError>({
    queryKey: ['reports', 'batches', filters],
    queryFn: () => reportsApi.getBatchesReport(filters),
  })
}
