import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { cashMovementsApi } from '../api/cashMovements.api'
import type { ListCashMovementsFilters, PaginatedCashMovementsResponse } from '../types/cashSession.types'

/**
 * features/cashSession/hooks/useCashMovements.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Caja — pestaña "Movimientos": primer consumidor de
 * `GET /cash/movements` (ya existente, filtro `cashSessionId` ya
 * soportado por el backend) — mismo criterio `[resource, action, filters]`
 * que el resto de hooks de listado del ERP.
 */
export function useCashMovements(filters?: ListCashMovementsFilters) {
  return useQuery<PaginatedCashMovementsResponse, AxiosError>({
    queryKey: ['cash-movements', 'list', filters],
    queryFn: () => cashMovementsApi.getCashMovements(filters),
    enabled: Boolean(filters?.cashSessionId),
  })
}
