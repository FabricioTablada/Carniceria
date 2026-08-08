import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { cashSessionsApi } from '../api/cashSessions.api'
import type { CashSession, OpenCashSessionDto } from '../types/cashSession.types'

export function useOpenCashSession() {
  const queryClient = useQueryClient()

  return useMutation<CashSession, AxiosError, OpenCashSessionDto>({
    mutationFn: (dto) => cashSessionsApi.openCashSession(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] })
    },
  })
}