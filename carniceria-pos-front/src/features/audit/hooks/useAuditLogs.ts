import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { auditApi } from '../api/audit.api'
import type { AuditLogFilters, PaginatedAuditLogsResponse } from '../types/audit.types'

/**
 * features/audit/hooks/useAuditLogs.ts
 * -----------------------------------------------------------------------------
 * Query keys `['audit', 'list', filters]` — mismo patrón `[resource, action,
 * ...params]` que el resto del ERP (`CLAUDE.md`). `enabled: Boolean(entityId)`
 * porque el único consumidor hoy (pestaña "Auditoría" de una compra) siempre
 * filtra por una entidad puntual (`entity: 'Purchase'`, `entityId`).
 */
export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery<PaginatedAuditLogsResponse, AxiosError>({
    queryKey: ['audit', 'list', filters],
    queryFn: () => auditApi.getAuditLogs(filters),
    enabled: Boolean(filters.entityId),
  })
}
