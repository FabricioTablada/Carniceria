import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { CashReportDetailResponse } from '../types/report.types'

/** `options.enabled` (Bloque POS-07, aditivo): permite que un panel que
 * puede estar cerrado (`CashSessionSummaryPanel.tsx`, mismo criterio que
 * `useSales`/`usePromotions`) evite la consulta mientras no este abierto.
 * Por defecto `true` — `CashSessionDetailPage.tsx` (unico consumidor
 * previo) sigue exactamente igual, sin pasar `options`. */
export function useCashReportDetail(id: string, options?: { enabled?: boolean }) {
  return useQuery<CashReportDetailResponse, AxiosError>({
    queryKey: ['reports', 'cash', 'detail', id],
    queryFn: () => reportsApi.getCashReportDetail(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}
