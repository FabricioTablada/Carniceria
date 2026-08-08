import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type { CreateProductDto, Product } from '../types/product.types'

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation<Product, AxiosError, CreateProductDto>({
    mutationFn: (dto) => productsApi.createProduct(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}