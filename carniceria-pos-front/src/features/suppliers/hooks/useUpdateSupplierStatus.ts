import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { suppliersApi } from '../api/suppliers.api'
import type {
  ChangeSupplierStatusDto,
  Supplier,
} from '../types/supplier.types'

export function useUpdateSupplierStatus() {
  const queryClient = useQueryClient()

  return useMutation<Supplier, AxiosError, { id: string; dto: ChangeSupplierStatusDto }>({
    mutationFn: ({ id, dto }) => suppliersApi.updateSupplierStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}