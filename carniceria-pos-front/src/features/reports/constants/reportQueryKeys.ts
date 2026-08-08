/**
 * features/reports/constants/reportQueryKeys.ts
 * -----------------------------------------------------------------------------
 * Corrección definitiva del sistema de invalidación de queries (aprobado):
 * único registro central de "evento de dominio -> queries afectadas" para
 * TODO el ERP, no solo reportes (el nombre del archivo quedó de la Fase 15,
 * cuando solo cubría el prefijo `['reports', ...]` — no se renombra/mueve el
 * archivo para no romper el patrón de imports ya establecido en ~12 hooks,
 * pero el contenido ahora es la fuente única de verdad de CUALQUIER query
 * afectada por un evento: `inventory`, `products`, `batches`, `reports/*`,
 * `notifications`, etc.).
 *
 * Antes de este bloque, cada hook de mutación mantenía su propia lista
 * parcial: invalidaba 2-3 queries "sueltas" (`['inventory']`, `['products']`)
 * a mano, más un loop sobre una constante que solo cubría el prefijo
 * `reports`. Resultado diagnosticado: cuando se agregaba una query nueva
 * (`['batches']`, `['reports','waste']`, `['reports','batches']`), nada
 * obligaba a revisar los ~12 hooks que deberían invalidarla — quedaban
 * desactualizados hasta recargar la página. Cada constante de abajo es
 * ahora la lista COMPLETA (no solo la porción de reportes) que un evento de
 * dominio afecta; el hook de mutación solo hace `for (const queryKey of X)
 * queryClient.invalidateQueries({ queryKey })` — un único punto de
 * mantenimiento por evento, en vez de N listas parciales distribuidas.
 *
 * Cada entrada matchea por prefijo (comportamiento default de React Query):
 * invalidar `['reports', 'cash']` alcanza tanto a `useCashReport` como a
 * `useCashReportDetail` (`['reports', 'cash', 'detail', id]`); invalidar
 * `['inventory']` alcanza `['inventory', 'list', filters]` y
 * `['inventory', 'wastes', 'list', filters]` por igual.
 *
 * Rendimiento (aprobado, "no invalidateQueries global"): cada lista incluye
 * ÚNICAMENTE las queries realmente afectadas por ESE evento — nunca el
 * prefijo completo `['reports']`, y nunca una query de un dominio no
 * relacionado. Ver el criterio de asignación de cada grupo en su propio
 * comentario.
 *
 * DEUDA TÉCNICA (heredada de la Fase 15, sigue vigente con el mismo
 * criterio): al agregar una query nueva bajo un prefijo ya cubierto acá
 * (ej. un reporte nuevo bajo `['reports', X]`, o un hook nuevo bajo
 * `['batches', X]`), revisar este archivo e incluir esa query en el/los
 * grupo(s) de evento que correspondan. Si se omite, la mutación relevante no
 * invalidará la query nueva.
 */

/** Cualquier clave de query de React Query — ya no se restringe a
 * `['reports', string]` (2-tupla fija): ahora conviven claves de un solo
 * segmento (`['inventory']`) con las de reportes (`['reports', 'waste']`). */
type AffectedQueryKey = readonly string[]

/**
 * Evento de dominio: "se registró/anuló/corrigió una venta, o una
 * devolución vinculada a una venta". Afecta lo que se calcula a partir de
 * `Sale` (dashboard, ventas, ventas por cajero/categoría/fecha, top
 * productos, ganancias) y, al mover stock, también inventario/bajo stock —
 * más las queries base `sales`/`inventory`/`products`/`notifications` que
 * antes cada hook invalidaba "suelto". Deliberadamente SIN `cash-sessions`
 * (ninguna mutación de venta escribe esa fila — se calcula solo al cerrar
 * la sesión, ver `useCloseCashSession.ts`) ni `purchases` (`Sale` no tiene
 * relación con `Purchase`).
 */
export const SALES_AFFECTED_QUERY_KEYS: readonly AffectedQueryKey[] = [
  ['sales'],
  ['inventory'],
  ['products'],
  ['reports', 'dashboard'],
  ['reports', 'sales'],
  ['reports', 'sales-by-cashier'],
  ['reports', 'sales-by-category'],
  ['reports', 'sales-by-date'],
  ['reports', 'top-products'],
  ['reports', 'profit'],
  ['reports', 'inventory'],
  ['reports', 'low-stock'],
  ['reports', 'cash'],
  ['notifications'],
]

/**
 * Evento de dominio: "una compra se creó o cambió de estado" (incluye
 * recibirla — `ReceivePurchaseDialog.tsx` usa `useUpdatePurchase` para
 * eso). Afecta `purchases`/`inventory`/`products` y, cuando el producto
 * requiere lote (`requiresBatch`), también `batches` (Compras crea/repone
 * lotes automáticamente al recibir) — CORRECCIÓN respecto al estado
 * anterior, que nunca invalidaba `batches`/`reports/batches` desde
 * Compras, dejando la pestaña Lotes desactualizada tras recibir. Dashboard,
 * compras, ganancias (costo) e inventario/bajo stock/lotes en reportes. NO
 * afecta nada relacionado con ventas ni caja (`Purchase` no tiene
 * `cashSessionId`).
 */
export const PURCHASE_AFFECTED_QUERY_KEYS: readonly AffectedQueryKey[] = [
  ['purchases'],
  ['inventory'],
  ['products'],
  ['batches'],
  ['reports', 'dashboard'],
  ['reports', 'purchases'],
  ['reports', 'profit'],
  ['reports', 'inventory'],
  ['reports', 'low-stock'],
  ['reports', 'batches'],
  ['notifications'],
]

/**
 * Evento de dominio: "se creó o ajustó manualmente una existencia" (alta
 * manual `POST /inventory`, ajuste `PATCH /inventory/:id` vía
 * `InventoryAdjustForm.tsx`). Solo cambia existencias — no genera ninguna
 * fila de `Sale`/`Purchase`/`InventoryWaste` ni toca `CashSession`/`Batch`
 * directamente, así que se queda corto y preciso: inventario/bajo stock en
 * reportes, `products` (el catálogo del POS embebe el stock), y
 * `notifications` (puede cruzar el umbral de `NEGATIVE_STOCK`/`LOW_STOCK`).
 */
export const STOCK_ADJUSTMENT_AFFECTED_QUERY_KEYS: readonly AffectedQueryKey[] = [
  ['inventory'],
  ['products'],
  ['reports', 'inventory'],
  ['reports', 'low-stock'],
  ['notifications'],
]

/**
 * Evento de dominio: "se registró una merma" (`POST /inventory/waste`).
 * Grupo SEPARADO de `STOCK_ADJUSTMENT_AFFECTED_QUERY_KEYS` (antes
 * compartían la misma lista parcial): una merma es la única mutación de
 * este grupo que genera una fila de `InventoryWaste` (afecta
 * `reports/waste`, CORRECCIÓN — antes no se invalidaba, dejando el KPI y
 * la vista "Análisis" de Mermas desactualizados) y puede consumir de un
 * lote puntual cuando el producto requiere lote (`batchId`, afecta
 * `batches`/`reports/batches`, CORRECCIÓN — mismo gap que Compras).
 */
export const INVENTORY_WASTE_AFFECTED_QUERY_KEYS: readonly AffectedQueryKey[] = [
  ['inventory'],
  ['products'],
  ['batches'],
  ['reports', 'inventory'],
  ['reports', 'low-stock'],
  ['reports', 'waste'],
  ['reports', 'batches'],
  ['notifications'],
]

/**
 * Evento de dominio: "se ajustó o bloqueó/cerró un lote" (`PATCH
 * /inventory/batches/:id` vía `useUpdateBatch.ts`). El backend sincroniza
 * `Inventory.quantity` de forma atómica (invariante `SUM(Batch.
 * availableQuantity ACTIVA) = Inventory.quantity`) — mismo motivo por el
 * que también afecta inventario/bajo stock en reportes y `notifications`
 * (puede resolver o disparar `NEGATIVE_STOCK`/`LOW_STOCK`). CORRECCIÓN:
 * antes `useUpdateBatch.ts` no invalidaba ninguna query de `reports`.
 */
export const BATCH_ADJUSTMENT_AFFECTED_QUERY_KEYS: readonly AffectedQueryKey[] = [
  ['batches'],
  ['inventory'],
  ['reports', 'batches'],
  ['reports', 'low-stock'],
  ['notifications'],
]

/**
 * Evento de dominio: "se cerró una sesión de caja o se registró un
 * movimiento de caja". Solo afecta el reporte de caja (cerrar/mover caja
 * no cambia ninguna `Sale`/`Purchase`). Las queries base
 * (`cash-sessions`/`cash-movements`, incluida la variante con `id`
 * dinámico de `useCreateCashMovement.ts`) siguen invalidándose en cada
 * hook por separado — no son compartidas entre los dos eventos de este
 * grupo, así que no corresponde unificarlas acá.
 */
export const CASH_AFFECTED_QUERY_KEYS: readonly AffectedQueryKey[] = [['reports', 'cash']]
