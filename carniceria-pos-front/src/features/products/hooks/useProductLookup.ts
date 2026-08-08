import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { productsApi } from '../api/products.api'
import type { LookupProductsResponse, ProductLookupFilters } from '../types/product.types'

/**
 * hooks/useProductLookup.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 2: hook del patron de lookup para
 * productos — mismo criterio de un hook por operacion que ya sigue
 * `useProducts.ts` (tabla), pero contra `GET /products/lookup`, no
 * `GET /products`. Consumido por `ProductSearchDialog.tsx`.
 */
export function useProductLookup(filters?: ProductLookupFilters) {
  return useQuery<LookupProductsResponse, AxiosError>({
    queryKey: ['products', 'lookup', filters],
    queryFn: () => productsApi.lookup(filters),
  })
}
