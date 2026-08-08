import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { categoriesApi } from '../api/categories.api'
import type {
  CategoryFilters,
  PaginatedCategoriesResponse,
} from '../types/category.types'

export function useCategories(filters?: CategoryFilters) {
  return useQuery<PaginatedCategoriesResponse, AxiosError>({
    queryKey: ['categories', 'list', filters],
    queryFn: () => categoriesApi.getCategories(filters),
  })
}