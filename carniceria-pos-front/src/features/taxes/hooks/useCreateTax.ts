import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { taxesApi } from '../api/taxes.api'
import type { CreateTaxDto, Tax } from '../types/tax.types'

export function useCreateTax() {
  const queryClient = useQueryClient()

  return useMutation<Tax, AxiosError, CreateTaxDto>({
    mutationFn: (dto) => taxesApi.createTax(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] })
    },
  })
}