import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { suppliersApi } from '../api/suppliers.api'

export function useDeleteSupplier() {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => suppliersApi.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}
