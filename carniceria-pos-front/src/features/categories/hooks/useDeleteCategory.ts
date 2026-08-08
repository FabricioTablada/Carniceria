import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { categoriesApi } from '../api/categories.api'

/** Mismo criterio que `useUpdateCategoryStatus.ts`/`useDeleteSupplier.ts`
 * (`features/suppliers/hooks/useDeleteSupplier.ts`): invalida el prefijo
 * `['categories']` completo, no una llave puntual. */
export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => categoriesApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
