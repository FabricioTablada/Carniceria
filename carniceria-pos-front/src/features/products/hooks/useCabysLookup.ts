import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { cabysApi } from '../api/cabys.api'
import type { CabysLookupFilters, LookupCabysResponse } from '../types/product.types'

/**
 * hooks/useCabysLookup.ts
 * -----------------------------------------------------------------------------
 * Version 1.1, Bloque 2: hook del patron de lookup para el catalogo CABYS —
 * mismo criterio que `useCustomerLookup.ts`. `enabled` evita disparar la
 * consulta cuando `ProductCabysField.tsx` no tiene ningun termino de
 * busqueda que enviar (campo vacio, popover cerrado).
 */
export function useCabysLookup(filters: CabysLookupFilters, enabled: boolean) {
  return useQuery<LookupCabysResponse, AxiosError>({
    queryKey: ['cabys', 'lookup', filters],
    queryFn: () => cabysApi.lookup(filters),
    enabled,
  })
}
