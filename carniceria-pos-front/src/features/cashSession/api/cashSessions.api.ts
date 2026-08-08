import { httpClient } from '@/lib/htpp/client'
import type {
  CashSession,
  CashSessionFilters,
  CloseCashSessionDto,
  OpenCashSessionDto,
  PaginatedCashSessionsResponse,
} from '../types/cashSession.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const cashSessionsApi = {
  getCashSessions: async (
    filters?: CashSessionFilters,
  ): Promise<PaginatedCashSessionsResponse> => {
    const { data } = await httpClient.get<PaginatedCashSessionsResponse>(
      '/cash/sessions',
      { params: filters },
    )

    return data
  },

  getCashSessionById: async (id: string): Promise<CashSession> => {
    const { data } = await httpClient.get<ApiEnvelope<CashSession>>(
      `/cash/sessions/${id}`,
    )

    return data.data
  },

  openCashSession: async (data: OpenCashSessionDto): Promise<CashSession> => {
    const { data: response } = await httpClient.post<ApiEnvelope<CashSession>>(
      '/cash/sessions',
      data,
    )

    return response.data
  },

  closeCashSession: async (
    id: string,
    data: CloseCashSessionDto,
  ): Promise<CashSession> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<CashSession>>(
      `/cash/sessions/${id}/close`,
      data,
    )

    return response.data
  },
}