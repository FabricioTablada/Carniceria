import type { CreateProductDto, Product } from '../types/product.types'

/**
 * features/products/utils/duplicateProduct.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Productos — acción rápida "Duplicar producto": traduce un
 * `Product` ya cargado a un `CreateProductDto` para precargar
 * `CreateProductPage.tsx` (mismo patrón ya aprobado en Compras,
 * `duplicatePurchaseToDto`). Puro: sin llamadas a la API, sin hooks.
 *
 * Se descartan `sku`/`barcode` (ambos únicos en el backend — duplicarlos
 * tal cual produciría un 409 al guardar) y `active` queda en `false`: un
 * duplicado nace como borrador de revisión, no reemplaza silenciosamente
 * al original en el catálogo activo.
 */
export function duplicateProductToDto(product: Product): CreateProductDto {
  return {
    categoryId: product.categoryId,
    taxId: product.taxId,
    sku: null,
    barcode: null,
    name: `${product.name} (copia)`,
    description: product.description,
    unitOfMeasure: product.unitOfMeasure,
    salePrice: product.salePrice,
    cost: product.cost,
    // Bloque 7.12: el codigo CABYS clasifica el mismo bien/servicio, asi
    // que se copia igual que el resto de los datos de clasificacion — si
    // el original no tenia (producto anterior a este bloque), queda
    // vacio y el formulario lo exige antes de guardar el duplicado.
    cabysCode: product.cabysCode ?? '',
    expectedWastePercent: product.expectedWastePercent,
    applyExpectedWasteToCost: product.applyExpectedWasteToCost,
    isVariableWeight: product.isVariableWeight,
    trackInventory: product.trackInventory,
    requiresBatch: product.requiresBatch,
    active: false,
  }
}
