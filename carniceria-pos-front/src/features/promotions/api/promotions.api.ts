import { httpClient } from '@/lib/htpp/client'
import type {
  ChangePromotionStatusDto,
  CreatePromotionDto,
  PaginatedPromotionsResponse,
  Promotion,
  PromotionFilters,
  UpdatePromotionDto,
} from '../types/promotion.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const promotionsApi = {
  getPromotions: async (filters?: PromotionFilters): Promise<PaginatedPromotionsResponse> => {
    const { data } = await httpClient.get<PaginatedPromotionsResponse>('/promotions', {
      params: filters,
    })

    return data
  },

  getPromotionById: async (id: string): Promise<Promotion> => {
    const { data } = await httpClient.get<ApiEnvelope<Promotion>>(`/promotions/${id}`)

    return data.data
  },

  createPromotion: async (data: CreatePromotionDto): Promise<Promotion> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Promotion>>(
      '/promotions',
      data,
    )

    return response.data
  },

  updatePromotion: async (id: string, data: UpdatePromotionDto): Promise<Promotion> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Promotion>>(
      `/promotions/${id}`,
      data,
    )

    return response.data
  },

  updatePromotionStatus: async (
    id: string,
    data: ChangePromotionStatusDto,
  ): Promise<Promotion> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Promotion>>(
      `/promotions/${id}/status`,
      data,
    )

    return response.data
  },

  deletePromotion: async (id: string): Promise<void> => {
    await httpClient.delete(`/promotions/${id}`)
  },
}
