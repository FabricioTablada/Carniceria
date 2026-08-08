import { httpClient } from '@/lib/htpp/client'
import type {
  CreateSaleReturnDto,
  PaginatedSaleReturnsResponse,
  SaleReturn,
  SaleReturnFilters,
} from '../types/return.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const returnsApi = {
  createReturn: async (data: CreateSaleReturnDto): Promise<SaleReturn> => {
    const { data: response } = await httpClient.post<ApiEnvelope<SaleReturn>>('/returns', data)

    return response.data
  },

  getReturns: async (filters?: SaleReturnFilters): Promise<PaginatedSaleReturnsResponse> => {
    const { data } = await httpClient.get<PaginatedSaleReturnsResponse>('/returns', {
      params: filters,
    })

    return data
  },
}
