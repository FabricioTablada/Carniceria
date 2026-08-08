import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { promotionsApi } from '../api/promotions.api'
import type { Promotion, UpdatePromotionDto } from '../types/promotion.types'

export function useUpdatePromotion() {
  const queryClient = useQueryClient()

  return useMutation<Promotion, AxiosError, { id: string; dto: UpdatePromotionDto }>({
    mutationFn: ({ id, dto }) => promotionsApi.updatePromotion(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
    },
  })
}
