import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { taxesApi } from '../api/taxes.api'

/** Mismo criterio que `useUpdateTaxStatus.ts`/
 * `features/categories/hooks/useDeleteCategory.ts`: invalida el prefijo
 * `['taxes']` completo, no una llave puntual. */
export function useDeleteTax() {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => taxesApi.deleteTax(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] })
    },
  })
}
