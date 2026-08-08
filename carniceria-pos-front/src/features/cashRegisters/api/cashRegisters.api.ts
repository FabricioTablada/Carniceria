import { httpClient } from '@/lib/htpp/client'
import type {
  CashRegisterFilters,
  PaginatedCashRegistersResponse,
} from '../types/cashRegister.types'

export const cashRegistersApi = {
  getCashRegisters: async (
    filters?: CashRegisterFilters,
  ): Promise<PaginatedCashRegistersResponse> => {
    const { data } = await httpClient.get<PaginatedCashRegistersResponse>(
      '/cash-registers',
      { params: filters },
    )

    return data
  },
}