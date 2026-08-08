import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'

/** Mismo criterio que `useUpdateProductStatus.ts`/
 * `features/categories/hooks/useDeleteCategory.ts`: invalida el prefijo
 * `['products']` completo, no una llave puntual. No confundir con
 * `useDeleteProductImage.ts` (borra unicamente la imagen del producto,
 * no el registro). */
export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => productsApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
