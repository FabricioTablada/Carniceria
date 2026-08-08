import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { cashSessionsApi } from '../api/cashSessions.api'
import type {
  CashSessionFilters,
  PaginatedCashSessionsResponse,
} from '../types/cashSession.types'

export function useCashSessions(filters?: CashSessionFilters) {
  return useQuery<PaginatedCashSessionsResponse, AxiosError>({
    queryKey: ['cash-sessions', 'list', filters],
    queryFn: () => cashSessionsApi.getCashSessions(filters),
  })
}