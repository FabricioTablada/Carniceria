import type { CreatePurchaseDto, CreatePurchaseItemDto, Purchase } from '../types/purchase.types'

/**
 * features/purchases/utils/duplicatePurchase.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — acción rápida "Duplicar compra anterior": traduce
 * una `Purchase` ya cargada (`usePurchase`/`usePurchases`, sin ninguna
 * consulta nueva) a un `CreatePurchaseDto` para precargar el formulario de
 * una compra nueva. Puro: sin llamadas a la API, sin hooks.
 *
 * Se descartan los 3 totales de línea (`lineSubtotal`/`lineTax`/
 * `lineTotal`) — el backend los vuelve a calcular siempre a partir de
 * `quantity`/`unitCost`, nunca los acepta del cliente (ver
 * `purchase.types.ts`). La nueva compra nace `DRAFT` (sin `status`
 * explícito, mismo valor por defecto que ya usa `PurchaseForm.tsx`) y sin
 * `documentNumber` (el de la compra original ya no aplica a esta nueva).
 */
export function duplicatePurchaseToDto(purchase: Purchase): CreatePurchaseDto {
  const items: CreatePurchaseItemDto[] = purchase.items.map((item) => ({
    productId: item.productId,
    taxId: item.taxId,
    quantity: item.quantity,
    unitCost: item.unitCost,
    expectedWastePercent: item.expectedWastePercent,
    supplierLotCode: item.supplierLotCode,
    productionDate: item.productionDate,
    expiryDate: item.expiryDate,
  }))

  return {
    supplierId: purchase.supplierId,
    notes: purchase.notes,
    items,
  }
}
