import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import type { LookupResponse } from '@/types/lookup'
import { customersApi } from '../api/customers.api'
import type { CustomerLookupFilters } from '../types/customer.types'

/**
 * hooks/useCustomerLookup.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 1: hook del patron de lookup para
 * clientes — mismo criterio que `useSupplierLookup.ts`, contra
 * `GET /customers/lookup`, no `GET /customers`. Sin consumidor todavia (la
 * seleccion de clientes en Ventas es Bloque 8.3) — se deja lista la
 * infraestructura pedida explicitamente en el Bloque 8.2.
 */
export function useCustomerLookup(filters?: CustomerLookupFilters) {
  return useQuery<LookupResponse, AxiosError>({
    queryKey: ['customers', 'lookup', filters],
    queryFn: () => customersApi.lookup(filters),
  })
}
