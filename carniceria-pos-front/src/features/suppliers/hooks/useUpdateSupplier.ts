import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { suppliersApi } from '../api/suppliers.api'
import type { Supplier, UpdateSupplierDto } from '../types/supplier.types'

export function useUpdateSupplier() {
  const queryClient = useQueryClient()

  return useMutation<Supplier, AxiosError, { id: string; dto: UpdateSupplierDto }>({
    mutationFn: ({ id, dto }) => suppliersApi.updateSupplier(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}