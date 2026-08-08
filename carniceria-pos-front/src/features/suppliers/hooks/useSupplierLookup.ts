import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import type { LookupResponse } from '@/types/lookup'
import { suppliersApi } from '../api/suppliers.api'
import type { SupplierLookupFilters } from '../types/supplier.types'

/**
 * hooks/useSupplierLookup.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 3: hook del patron de lookup para
 * proveedores — mismo criterio que `useProductLookup.ts`/
 * `useCategoryLookup.ts` (Bloque 2), contra `GET /suppliers/lookup`, no
 * `GET /suppliers`. Consumido por `SupplierSearchDialog.tsx`.
 */
export function useSupplierLookup(filters?: SupplierLookupFilters) {
  return useQuery<LookupResponse, AxiosError>({
    queryKey: ['suppliers', 'lookup', filters],
    queryFn: () => suppliersApi.lookup(filters),
  })
}
