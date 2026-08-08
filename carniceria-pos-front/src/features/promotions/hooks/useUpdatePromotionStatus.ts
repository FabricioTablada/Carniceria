import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { promotionsApi } from '../api/promotions.api'
import type { ChangePromotionStatusDto, Promotion } from '../types/promotion.types'

export function useUpdatePromotionStatus() {
  const queryClient = useQueryClient()

  return useMutation<Promotion, AxiosError, { id: string; dto: ChangePromotionStatusDto }>({
    mutationFn: ({ id, dto }) => promotionsApi.updatePromotionStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
    },
  })
}
