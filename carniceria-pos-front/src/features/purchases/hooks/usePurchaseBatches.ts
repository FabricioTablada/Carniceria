import { useMemo } from 'react'
import { useBatches } from '@/features/batches/hooks/useBatches'
import type { Batch } from '@/features/batches/types/batch.types'
import type { Purchase } from '../types/purchase.types'

/**
 * features/purchases/hooks/usePurchaseBatches.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — pestaña "Lotes" del detalle: qué lotes generó ESTA
 * compra al recibirse. El backend ya guarda ese vínculo
 * (`Batch.purchaseItemId`), pero `GET /inventory/batches` no acepta un
 * filtro `purchaseId`/`purchaseItemId` (`BatchFilters` solo tiene
 * `productId`/`sucursalId`/`supplierId`/`status`) — mismo tipo de limitación
 * ya documentado en `useProductWasteHistory.ts` para `productId` en
 * Compras.
 *
 * Se acota la consulta por `supplierId` (un filtro real que SÍ existe) —
 * todo lote de esta compra tiene el mismo proveedor que la compra misma —
 * y se filtra en el cliente por `purchaseItemId` perteneciendo a los ids de
 * línea de esta compra. `limit: 100`: mismo techo de una sola página que el
 * resto de ventanas de este módulo.
 */
export function usePurchaseBatches(purchase: Purchase | undefined) {
  const purchaseItemIds = useMemo(() => new Set(purchase?.items.map((item) => item.id) ?? []), [purchase])

  const { data, isLoading, error } = useBatches(
    purchase ? { supplierId: purchase.supplierId, limit: 100 } : undefined,
    { enabled: Boolean(purchase) },
  )

  const batches = useMemo<Batch[]>(() => {
    if (!data || !purchase) {
      return []
    }

    return data.data.filter((batch) => batch.purchaseItemId && purchaseItemIds.has(batch.purchaseItemId))
  }, [data, purchase, purchaseItemIds])

  return { data: batches, isLoading: Boolean(purchase) && isLoading, error }
}
