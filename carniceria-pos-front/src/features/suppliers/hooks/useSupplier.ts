import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { suppliersApi } from '../api/suppliers.api'
import type { Supplier } from '../types/supplier.types'

export function useSupplier(id: string) {
  return useQuery<Supplier, AxiosError>({
    queryKey: ['suppliers', 'detail', id],
    queryFn: () => suppliersApi.getSupplierById(id),
    enabled: Boolean(id),
  })
}