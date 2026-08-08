import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { categoriesApi } from '../api/categories.api'
import type { ChangeCategoryStatusDto, Category } from '../types/category.types'

export function useUpdateCategoryStatus() {
  const queryClient = useQueryClient()

  return useMutation<Category, AxiosError, { id: string; dto: ChangeCategoryStatusDto }>({
    mutationFn: ({ id, dto }) => categoriesApi.updateCategoryStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}