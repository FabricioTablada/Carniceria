import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type { Product, UpdateProductDto } from '../types/product.types'

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation<Product, AxiosError, { id: string; dto: UpdateProductDto }>({
    mutationFn: ({ id, dto }) => productsApi.updateProduct(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}