import { httpClient } from '@/lib/htpp/client'
import type { AuditLogFilters, PaginatedAuditLogsResponse } from '../types/audit.types'

/**
 * features/audit/api/audit.api.ts
 * -----------------------------------------------------------------------------
 * Cliente HTTP de `GET /audit` — endpoint YA EXISTENTE (`modules/audit`,
 * backend), sin cambios. Mismo patrón que `purchases.api.ts`: un objeto con
 * un método por operación, `httpClient` (Axios) como única puerta de
 * salida — ningún componente llama a `httpClient` directamente.
 */
export const auditApi = {
  getAuditLogs: async (filters?: AuditLogFilters): Promise<PaginatedAuditLogsResponse> => {
    const { data } = await httpClient.get<PaginatedAuditLogsResponse>('/audit', { params: filters })

    return data
  },
}
