import type { CreatePurchaseItemDto } from '../types/purchase.types'

/**
 * features/purchases/utils/purchase.utils.ts
 * -----------------------------------------------------------------------------
 * Helpers del modulo Purchases que no son forma de datos (types.ts), regla
 * de validacion (schema.ts) ni componente. Unica fuente de verdad para
 * valores compartidos entre `PurchaseForm.tsx` y `PurchaseItemsField.tsx`.
 */

/** Forma de un item vacio, usada tanto para inicializar `items` en
 * `PurchaseForm.tsx` (una linea visible al arrancar) como para agregar
 * una linea nueva en `PurchaseItemsField.tsx` ("Agregar linea"). Vive
 * aca, no en ninguno de esos dos componentes, para evitar duplicar esta
 * definicion (y porque un archivo de componente no puede exportar
 * ademas una constante sin romper la regla de ESLint
 * `react-refresh/only-export-components`).
 *
 * QA de UX de campos numericos (Bloque 2): `unitCost: 0` NO se cambia
 * aca — sigue siendo el valor numerico neutro que exige
 * `CreatePurchaseItemDto.unitCost: number` (el DTO real que via
 * `PurchaseForm.tsx` termina en `POST /purchases`, sin tocar). Que el
 * campo se vea VACIO en pantalla (en vez de mostrar "0") es
 * responsabilidad exclusiva de `PurchaseItemRow.tsx`, que mantiene su
 * propio buffer de texto (`unitCostText`) y lo inicializa como `''`
 * cuando el numero es `0` — mismo criterio ya usado en
 * `SaleCorrectForm.tsx` (Bloque 1) para "Descuento". Separar "que numero
 * viaja en el DTO" de "que texto ve el usuario" es exactamente lo que
 * evita el bug de coma flotante (`Number("5500.")` sin el punto) sin
 * tener que inventar un tipo `number | ''` en el DTO. */
export const EMPTY_ITEM: CreatePurchaseItemDto = {
  productId: '',
  taxId: null,
  quantity: 1,
  unitCost: 0,
  // Bloque COST-06.1: `null` hasta que se elija un producto —
  // `populatePurchaseItemFromProduct` (`PurchaseItemsField.tsx`) lo
  // precarga con `Product.expectedWastePercent` en ese momento.
  expectedWastePercent: null,
  // Bloque LOTES-09: `null` por defecto — a diferencia de
  // `expectedWastePercent`, estos 3 NUNCA se precargan desde el producto
  // (son datos de ESTA recepción puntual, sin un valor por defecto del
  // catálogo del que copiarlos), el usuario los tipea directamente en la
  // fila cuando `selectedProduct.requiresBatch` es `true`
  // (`PurchaseItemRow.tsx`).
  supplierLotCode: null,
  productionDate: null,
  expiryDate: null,
}

/** Valor centinela para "sin impuesto" en los Select de impuesto (por linea
 * y el selector masivo de `PurchaseItemsField.tsx`) — Select no admite un
 * `value=""` real como opcion seleccionable junto a otras vacias. Antes
 * duplicado como constante local en `PurchaseItemsField.tsx`; ahora
 * tambien lo usa `PurchaseItemRow.tsx`, de ahi que viva aca. */
export const NO_TAX_VALUE = '__no_tax__'

/** Formatea `purchaseDate` (ISO string, con u sin hora) como `"DD/MM/YYYY"`.
 * Unica fuente de verdad: antes duplicada, byte a byte, en
 * `PurchasesTable.tsx` y `PurchaseDetailPage.tsx`. No usa `new Date()`
 * (sujeto a la zona horaria del navegador) — recorta el string a los
 * primeros 10 caracteres (`"YYYY-MM-DD"`) y reordena, mismo criterio ya
 * documentado en `EditPurchasePage.tsx` para `<input type="date">`. */
export function formatPurchaseDate(purchaseDate: string): string {
  const [year, month, day] = purchaseDate.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}