import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { categoriesApi } from '../api/categories.api'
import type { Category, CreateCategoryDto } from '../types/category.types'

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation<Category, AxiosError, CreateCategoryDto>({
    mutationFn: (dto) => categoriesApi.createCategory(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}