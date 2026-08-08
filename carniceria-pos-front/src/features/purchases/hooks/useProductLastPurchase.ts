import { useMemo } from 'react'
import { usePurchasesWindow } from './usePurchasesWindow'

export interface ProductLastPurchaseInfo {
  lastUnitCost: number
  lastSupplierName: string
  lastPurchaseDate: string
  /** `null` cuando esta es la unica compra conocida del producto en la
   * ventana (sin punto de comparacion). */
  previousUnitCost: number | null
  /** Variacion porcentual entre `previousUnitCost` y `lastUnitCost`,
   * redondeada a 1 decimal — `null` cuando no hay `previousUnitCost`. */
  variationPercent: number | null
}

/**
 * features/purchases/hooks/useProductLastPurchase.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — tarjetas de producto enriquecidas: "ultimo costo de
 * compra", "ultimo proveedor" y "variacion vs. compra anterior", derivados
 * de la misma ventana de compras recientes que ya usa
 * `useProductWasteHistory.ts` (`usePurchasesWindow.ts`, ver ese archivo para
 * la limitacion de las 100 compras mas recientes). Sin endpoint nuevo: el
 * backend no expone `Product.lastPurchaseCost`/`averageCost` (confirmado —
 * `Product` en `schema.prisma` solo tiene `cost`, el costo de REFERENCIA
 * editable a mano, no un snapshot de compra), asi que esta es la unica
 * forma honesta de mostrar "ultimo costo" sin tocar el backend.
 *
 * Ordena por `purchase.purchaseDate` descendente (las compras del backend
 * ya llegan mas recientes primero, pero no se asume ese orden a proposito)
 * y toma las DOS lineas mas recientes de ESTE producto para poder mostrar
 * la variacion frente a la compra anterior.
 */
export function useProductLastPurchase(productId: string) {
  const { data, isLoading } = usePurchasesWindow()

  const info = useMemo<ProductLastPurchaseInfo | null>(() => {
    if (!data || !productId) {
      return null
    }

    const matches = data
      .flatMap((purchase) =>
        purchase.items
          .filter((item) => item.productId === productId)
          .map((item) => ({
            unitCost: item.unitCost,
            supplierName: purchase.supplier.name,
            purchaseDate: purchase.purchaseDate,
          })),
      )
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())

    if (matches.length === 0) {
      return null
    }

    const [last, previous] = matches
    const previousUnitCost = previous?.unitCost ?? null
    const variationPercent =
      previousUnitCost && previousUnitCost !== 0
        ? Math.round(((last.unitCost - previousUnitCost) / previousUnitCost) * 1000) / 10
        : null

    return {
      lastUnitCost: last.unitCost,
      lastSupplierName: last.supplierName,
      lastPurchaseDate: last.purchaseDate,
      previousUnitCost,
      variationPercent,
    }
  }, [data, productId])

  return { data: info, isLoading: productId ? isLoading : false }
}
