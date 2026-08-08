import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type { Product } from '../types/product.types'

/** Bloque 10 (gestion de imagenes): crea o reemplaza la imagen de un
 * producto ya existente. Mismo criterio de invalidacion que
 * `useUpdateProduct` — por prefijo (`['products']`), asi tanto el listado
 * como `useProduct(id)` (detalle) recogen la nueva `imageUrl` (con su
 * `?v=` de cache-busting ya resuelto por el backend). */
export function useUploadProductImage() {
  const queryClient = useQueryClient()

  return useMutation<Product, AxiosError, { id: string; file: File }>({
    mutationFn: ({ id, file }) => productsApi.uploadProductImage(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
