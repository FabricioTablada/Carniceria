import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type {
  PaginatedProductsResponse,
  ProductFilters,
} from '../types/product.types'

interface UseProductsOptions {
  /** Corrección del sistema de invalidación (aprobado): el catálogo del
   * POS (`SalesPOSPage.tsx`) es la única pantalla donde "recargar para
   * ver el stock actualizado" es inaceptable en operación real — y es
   * también la más expuesta a quedar con caché desactualizada entre
   * dispositivos/pestañas (compra recibida desde otra sesión del
   * navegador, donde `invalidateQueries` de esta misma pestaña no puede
   * llegar). `refetchOnWindowFocus` está en `false` por defecto para TODO
   * el ERP (`lib/query/queryClient.ts`) — se sobreescribe únicamente acá,
   * por request, sin tocar el default global ni ningún otro consumidor de
   * `useProducts`. Al volver a la pestaña/ventana del POS (el momento
   * natural en el que un cajero retoma la venta), refresca el stock en
   * segundo plano sin que el usuario tenga que recargar la aplicación. */
  refetchOnWindowFocus?: boolean
}

export function useProducts(filters?: ProductFilters, options?: UseProductsOptions) {
  return useQuery<PaginatedProductsResponse, AxiosError>({
    queryKey: ['products', 'list', filters],
    queryFn: () => productsApi.getProducts(filters),
    // `refetchOnWindowFocus` solo se incluye en el objeto de opciones
    // cuando el consumidor lo pasa explícitamente — sin esto, un
    // `refetchOnWindowFocus: undefined` literal podría pisar el default
    // global (`false`, `lib/query/queryClient.ts`) con `undefined` en vez
    // de dejarlo heredar, cambiando el comportamiento de los demás
    // consumidores de `useProducts` que no piden esta opción.
    ...(options?.refetchOnWindowFocus !== undefined && {
      refetchOnWindowFocus: options.refetchOnWindowFocus,
    }),
  })
}