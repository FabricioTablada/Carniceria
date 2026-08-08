import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { categoriesApi } from '../api/categories.api'
import type { Category, UpdateCategoryDto } from '../types/category.types'

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation<Category, AxiosError, { id: string; dto: UpdateCategoryDto }>({
    mutationFn: ({ id, dto }) => categoriesApi.updateCategory(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}