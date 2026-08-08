import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { categoriesApi } from '../api/categories.api'
import type { CategoryLookupFilters, LookupCategoriesResponse } from '../types/category.types'

/**
 * hooks/useCategoryLookup.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 2: hook del patron de lookup para
 * categorias — mismo criterio que `useProductLookup.ts`, contra
 * `GET /categories/lookup`, no `GET /categories`. Consumido por
 * `CategorySearchDialog.tsx`.
 */
export function useCategoryLookup(filters?: CategoryLookupFilters) {
  return useQuery<LookupCategoriesResponse, AxiosError>({
    queryKey: ['categories', 'lookup', filters],
    queryFn: () => categoriesApi.lookup(filters),
  })
}
