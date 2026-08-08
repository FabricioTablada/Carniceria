import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { promotionsApi } from '../api/promotions.api'
import type { Promotion } from '../types/promotion.types'

export function usePromotion(id: string) {
  return useQuery<Promotion, AxiosError>({
    queryKey: ['promotions', 'detail', id],
    queryFn: () => promotionsApi.getPromotionById(id),
    enabled: Boolean(id),
  })
}
