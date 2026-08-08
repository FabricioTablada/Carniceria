import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { promotionsApi } from '../api/promotions.api'
import type { CreatePromotionDto, Promotion } from '../types/promotion.types'

export function useCreatePromotion() {
  const queryClient = useQueryClient()

  return useMutation<Promotion, AxiosError, CreatePromotionDto>({
    mutationFn: (dto) => promotionsApi.createPromotion(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
    },
  })
}
