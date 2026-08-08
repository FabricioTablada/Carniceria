import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { promotionsApi } from '../api/promotions.api'

/** Mismo criterio que `useUpdatePromotionStatus.ts`/
 * `features/categories/hooks/useDeleteCategory.ts`: invalida el prefijo
 * `['promotions']` completo, no una llave puntual. */
export function useDeletePromotion() {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => promotionsApi.deletePromotion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
    },
  })
}
