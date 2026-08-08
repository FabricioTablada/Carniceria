import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { promotionsApi } from '../api/promotions.api'
import type { PaginatedPromotionsResponse, PromotionFilters } from '../types/promotion.types'

export function usePromotions(filters?: PromotionFilters) {
  return useQuery<PaginatedPromotionsResponse, AxiosError>({
    queryKey: ['promotions', 'list', filters],
    queryFn: () => promotionsApi.getPromotions(filters),
  })
}
