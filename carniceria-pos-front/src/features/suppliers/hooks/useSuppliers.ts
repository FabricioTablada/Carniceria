import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { suppliersApi } from '../api/suppliers.api'
import type {
  PaginatedSuppliersResponse,
  SupplierFilters,
} from '../types/supplier.types'

export function useSuppliers(filters?: SupplierFilters) {
  return useQuery<PaginatedSuppliersResponse, AxiosError>({
    queryKey: ['suppliers', 'list', filters],
    queryFn: () => suppliersApi.getSuppliers(filters),
  })
}