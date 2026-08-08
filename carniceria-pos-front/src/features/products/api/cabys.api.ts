import { httpClient } from '@/lib/htpp/client'
import type { CabysLookupFilters, LookupCabysResponse } from '../types/product.types'

/**
 * features/products/api/cabys.api.ts
 * -----------------------------------------------------------------------------
 * Version 1.1, Bloque 2: consume `GET /cabys/lookup` (modulo CABYS del
 * backend, solo lectura). Vive en `features/products/` porque su unico
 * consumidor es `ProductCabysField.tsx` — mismo criterio que
 * `ProductCategoryField.tsx`/`ProductTaxField.tsx`, que tampoco tienen su
 * propio feature aunque Categorias/Impuestos sean modulos independientes.
 */
export const cabysApi = {
  lookup: async (filters?: CabysLookupFilters): Promise<LookupCabysResponse> => {
    const { data } = await httpClient.get<LookupCabysResponse>('/cabys/lookup', {
      params: filters,
    })

    return data
  },
}
