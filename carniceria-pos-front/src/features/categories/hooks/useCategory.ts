import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { categoriesApi } from '../api/categories.api'
import type { Category } from '../types/category.types'

export function useCategory(id: string) {
  return useQuery<Category, AxiosError>({
    queryKey: ['categories', 'detail', id],
    queryFn: () => categoriesApi.getCategoryById(id),
    enabled: Boolean(id),
  })
}