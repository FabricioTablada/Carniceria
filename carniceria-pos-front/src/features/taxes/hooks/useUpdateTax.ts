import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { taxesApi } from '../api/taxes.api'
import type { Tax, UpdateTaxDto } from '../types/tax.types'

export function useUpdateTax() {
  const queryClient = useQueryClient()

  return useMutation<Tax, AxiosError, { id: string; dto: UpdateTaxDto }>({
    mutationFn: ({ id, dto }) => taxesApi.updateTax(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] })
    },
  })
}