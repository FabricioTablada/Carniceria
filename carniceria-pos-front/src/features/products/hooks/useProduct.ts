import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type { Product } from '../types/product.types'

export function useProduct(id: string) {
  return useQuery<Product, AxiosError>({
    queryKey: ['products', 'detail', id],
    queryFn: () => productsApi.getProductById(id),
    enabled: Boolean(id),
  })
}