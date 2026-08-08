import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { taxesApi } from '../api/taxes.api'
import type { ChangeTaxStatusDto, Tax } from '../types/tax.types'

export function useUpdateTaxStatus() {
  const queryClient = useQueryClient()

  return useMutation<Tax, AxiosError, { id: string; dto: ChangeTaxStatusDto }>({
    mutationFn: ({ id, dto }) => taxesApi.updateTaxStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] })
    },
  })
}