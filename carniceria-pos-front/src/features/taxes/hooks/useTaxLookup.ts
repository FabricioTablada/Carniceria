import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import type { LookupResponse } from '@/types/lookup'
import { taxesApi } from '../api/taxes.api'
import type { TaxLookupFilters } from '../types/tax.types'

/**
 * hooks/useTaxLookup.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 3: hook del patron de lookup para
 * impuestos — contra `GET /taxes/lookup`, no `GET /taxes`. Impuestos se
 * trata como catalogo de referencia acotado: este hook alimenta
 * `<Select>` simples (product/purchase forms), no un dialogo de busqueda.
 */
export function useTaxLookup(filters?: TaxLookupFilters) {
  return useQuery<LookupResponse, AxiosError>({
    queryKey: ['taxes', 'lookup', filters],
    queryFn: () => taxesApi.lookup(filters),
  })
}
