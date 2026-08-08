import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type { Product } from '../types/product.types'

/** Bloque 10 (gestion de imagenes): elimina la imagen de un producto ya
 * existente (el producto vuelve al placeholder). Mismo criterio de
 * invalidacion que el resto de las mutaciones del modulo. */
export function useDeleteProductImage() {
  const queryClient = useQueryClient()

  return useMutation<Product, AxiosError, { id: string }>({
    mutationFn: ({ id }) => productsApi.deleteProductImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
