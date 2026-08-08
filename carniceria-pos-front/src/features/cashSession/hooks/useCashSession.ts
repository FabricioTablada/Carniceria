import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { cashSessionsApi } from '../api/cashSessions.api'
import type { CashSession } from '../types/cashSession.types'

export function useCashSession(id: string) {
  return useQuery<CashSession, AxiosError>({
    queryKey: ['cash-sessions', 'detail', id],
    queryFn: () => cashSessionsApi.getCashSessionById(id),
    enabled: Boolean(id),
  })
}