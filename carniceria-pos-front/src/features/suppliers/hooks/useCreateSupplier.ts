import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { suppliersApi } from '../api/suppliers.api'
import type { CreateSupplierDto, Supplier } from '../types/supplier.types'

export function useCreateSupplier() {
  const queryClient = useQueryClient()

  return useMutation<Supplier, AxiosError, CreateSupplierDto>({
    mutationFn: (dto) => suppliersApi.createSupplier(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}