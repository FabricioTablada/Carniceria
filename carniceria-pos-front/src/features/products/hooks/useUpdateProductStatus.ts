import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type { ChangeProductStatusDto, Product } from '../types/product.types'

export function useUpdateProductStatus() {
  const queryClient = useQueryClient()

  return useMutation<Product, AxiosError, { id: string; dto: ChangeProductStatusDto }>({
    mutationFn: ({ id, dto }) => productsApi.updateProductStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}