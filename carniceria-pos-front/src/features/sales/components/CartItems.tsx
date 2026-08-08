import { useState } from 'react'
import { Minus, Plus, Scale, ShoppingCart, Tag, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatQuantity } from '@/utils/formatQuantity'
import { resolveStockStatus } from '@/utils/stockStatus'
import type { Product } from '@/features/products/types/product.types'
import type { SaleQuoteItemResponse } from '../types/sale.types'

/** Linea del carrito: producto agregado + cantidad. Estado local de la
 * pantalla (dueno: SalesPOSPage), no un DTO del backend. Para productos
 * `unitOfMeasure: 'KILOGRAM'`, `quantity` es el PESO (decimal, ver
 * `ProductWeightDialog.tsx`) — mismo campo, sin agregar uno nuevo. */
export interface CartLine {
  product: Product
  quantity: number
}

interface CartItemsProps {
  /** Lineas del carrito. El componente no mantiene estado propio. */
  lines: CartLine[]
  /** Mensaje mostrado cuando `lines` esta vacio. */
  emptyMessage?: string
  /** Solo aplica a productos por UNIDAD (stepper +/-1, sin cambios). */
  onIncrease: (productId: string) => void
  onDecrease: (productId: string) => void
  onRemove: (productId: string) => void
  /** Rediseño del POS (aprobado): cantidad editable para productos por
   * UNIDAD — click sobre el numero, escribe el valor exacto. Opcional:
   * sin este prop, el numero deja de ser clickeable (compatibilidad). */
  onSetQuantity?: (productId: string, quantity: number) => void
  /** Rediseño del POS (aprobado): "cambiar definitivamente la decisión del
   * peso variable" — para productos por KILOGRAMO, abre
   * `ProductWeightDialog.tsx` para editar el peso ya cargado (agregar uno
   * nuevo pasa por el mismo dialogo desde `SalesPOSPage.tsx`, no desde
   * aca). Opcional: sin este prop, el peso se muestra de solo lectura. */
  onEditWeight?: (productId: string) => void
  /**
   * Bloque P.8.2: `quote.data.items` de `useSaleQuote()` — mismo orden que
   * `lines` (contrato de posicion verificado contra el backend, ver
   * `SaleQuoteItemResponse` en `sale.types.ts`). `undefined` mientras la
   * cotizacion todavia no resolvio (carrito recien creado, antes del
   * primer resultado) — en ese caso cada linea muestra su monto base
   * (precio unitario x cantidad, sin promocion) igual que siempre.
   */
  quoteItems?: SaleQuoteItemResponse[]
  /** Bloque "Modo Cobrar" (aprobado): `true` mientras se esta cobrando —
   * el pedido queda de SOLO LECTURA (sin stepper, sin cantidad editable,
   * sin editar peso, sin quitar lineas). No cambia ningun dato, solo
   * oculta los controles interactivos; `SalesPOSPage.tsx` es quien decide
   * este valor segun `posMode`. `false` por defecto (mismo comportamiento
   * de siempre para Modo Vender). */
  readOnly?: boolean
  /** Rediseño del POS (aprobado, "carrito vacío — accesos rápidos"):
   * favoritos/recientes ya combinados por `SalesPOSPage.tsx` — solo se
   * muestran cuando el carrito está vacío. Opcional/aditivo: sin esta
   * prop (o con un array vacío), el estado vacío se ve exactamente igual
   * que antes de este bloque, sin ruido visual agregado. */
  quickAccessProducts?: Product[]
  onQuickAdd?: (product: Product) => void
}

/** Cantidad de una linea UNIT: numero de solo lectura, o un input inline
 * al hacer click (si se recibe `onSetQuantity`). Estado puramente de
 * presentacion (que linea esta en edicion), no de negocio — el valor real
 * sigue viviendo en `cart` (`SalesPOSPage.tsx`). */
function EditableQuantity({
  productId,
  quantity,
  maxQuantity,
  onSetQuantity,
}: {
  productId: string
  quantity: number
  maxQuantity?: number
  onSetQuantity?: (productId: string, quantity: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  if (!onSetQuantity) {
    return <span className="w-7 text-center text-sm font-bold tabular-nums text-[var(--pos-ink)]">{quantity}</span>
  }

  const commit = () => {
    const parsed = Math.round(Number(draft))
    if (Number.isFinite(parsed) && parsed > 0) {
      const clamped = maxQuantity != null ? Math.min(parsed, maxQuantity) : parsed
      onSetQuantity(productId, clamped)
    }
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <input
        type="number"
        autoFocus
        min={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
        }}
        className="w-11 rounded-md border border-[var(--pos-border)] bg-[var(--pos-bg)] text-center text-sm font-bold tabular-nums text-[var(--pos-ink)] outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(String(quantity))}
      title="Escribir cantidad exacta"
      className="w-7 rounded text-center text-sm font-bold tabular-nums text-[var(--pos-ink)] hover:text-brand"
    >
      {quantity}
    </button>
  )
}

/**
 * features/sales/components/CartItems.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del POS ("terminal propia", aprobado): tarjetas de trabajo
 * sobre la superficie oscura EXCLUSIVA del POS (`--pos-panel`/
 * `--pos-border`/`--pos-ink`, `.pos-surface` en `index.css`) — ya no
 * `bg-card`/`border-border` (tokens compartidos con el Backoffice). Mismos
 * datos/handlers de siempre.
 *
 * Cambia la decisión sobre peso variable (aprobado): productos
 * `unitOfMeasure: 'KILOGRAM'` muestran el peso como un chip clickeable que
 * abre `ProductWeightDialog.tsx` (via `onEditWeight`) en vez del stepper
 * +/-1 — ya NO se espera una báscula electrónica. Productos `UNIT` siguen
 * con el mismo stepper, mas la cantidad ahora es editable con un click
 * (`EditableQuantity`, arriba) para cargar cantidades grandes sin
 * multiples clics. Nunca se mezclan ambos comportamientos en la misma
 * linea.
 *
 * Se conservan, sin cambios: miniatura `ProductThumbnail`, correlación por
 * posición con `quoteItems` (Bloque P.8.2), chips de contexto (promoción
 * aplicada / aviso de stock, mismos datos que ya recibia esta fila).
 *
 * Pulido visual (aprobado, "líneas más limpias, mejor distribución"):
 * mas aire dentro de cada tarjeta (`px-2.5 py-2` -> `px-3 py-2.5`, gap
 * general `gap-2.5` -> `gap-3`), stepper de cantidad con mas separacion
 * entre controles (`gap-1` -> `gap-1.5`), columna de precio un poco mas
 * ancha (`w-16` -> `w-[4.75rem]`) para que el monto quede mejor alineado
 * y respire respecto al boton de eliminar.
 *
 * Pulido visual (aprobado, "Modo Cobrar" — mejoras al Pedido mientras se
 * cobra, sin cambios de logica): miniatura un poco mas grande (`h-9` ->
 * `h-11`) y mas separada del texto, precio unitario menos protagonista
 * (mas chico/tenue), cantidad con mas contraste (`EditableQuantity` gana
 * tamaño), total de linea mas grande/marcado (antes competia visualmente
 * con el nombre del producto).
 *
 * Bloque "Modo Cobrar" (aprobado, "el pedido debe quedar completamente en
 * modo lectura"): con `readOnly`, el stepper +/-, la cantidad clickeable,
 * el chip de editar peso y el boton de quitar linea dejan de renderizarse
 * — se reemplazan por texto plano (cantidad/peso) sin ningun handler. No
 * se quita ni se modifica ningun dato: `onIncrease`/`onDecrease`/
 * `onRemove`/`onSetQuantity`/`onEditWeight` simplemente no se invocan
 * mientras `readOnly` es `true`.
 */
export function CartItems({
  lines,
  emptyMessage = 'El carrito está vacío.',
  onIncrease,
  onDecrease,
  onRemove,
  onSetQuantity,
  onEditWeight,
  quoteItems,
  readOnly = false,
  quickAccessProducts = [],
  onQuickAdd,
}: CartItemsProps) {
  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="w-full max-w-56 rounded-2xl border border-dashed border-[var(--pos-border)] px-6 py-8">
          <EmptyState
            icon={ShoppingCart}
            title={emptyMessage}
            description="Busca o toca un producto del catálogo para agregarlo."
            className="[&_p]:text-[var(--pos-ink-muted)]"
          />
        </div>

        {/* Rediseño del POS (aprobado, "carrito vacío — accesos rápidos,
            solo si mejora la experiencia"): favoritos/recientes ya
            resueltos por `SalesPOSPage.tsx` — se oculta por completo sin
            ninguno (turno recién empezado), sin dejar un contenedor vacío. */}
        {onQuickAdd && quickAccessProducts.length > 0 && (
          <div className="flex w-full max-w-56 flex-col gap-1.5">
            <span className="text-[0.625rem] font-semibold tracking-wide text-[var(--pos-ink-muted)] uppercase">
              Acceso rápido
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickAccessProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onQuickAdd(product)}
                  className="max-w-full truncate rounded-full border border-[var(--pos-border)] bg-[var(--pos-panel)] px-2.5 py-1 text-xs font-medium text-[var(--pos-ink)] transition-colors hover:border-brand/40 hover:text-brand"
                >
                  {product.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2.5 px-3 py-2.5">
      {lines.map((line, index) => {
        const isWeighted = line.product.unitOfMeasure === 'KILOGRAM'
        const rawLineTotal = line.product.salePrice * line.quantity

        // Bloque P.8.2: correlacion por POSICION (contrato verificado del
        // backend, ver doc de `SaleQuoteItemResponse`), con un chequeo
        // defensivo de `productId` para el unico caso en que la posicion
        // puede desalinearse momentaneamente: `placeholderData:
        // keepPreviousData` (useSaleQuote) sigue mostrando la cotizacion
        // ANTERIOR mientras la nueva esta en camino — si el carrito
        // cambio de forma (se elimino/reordeno una linea) entre una
        // cotizacion y la siguiente, los indices de la cotizacion vieja ya
        // no representan las mismas lineas. Sin este chequeo, una linea
        // podria mostrar por un instante el descuento de OTRO producto.
        const quoteItem = quoteItems?.[index]
        const matchesLine = quoteItem?.productId === line.product.id ? quoteItem : undefined
        const hasPromotion = Boolean(matchesLine && matchesLine.promotionDiscount > 0)
        const displayedLineTotal = matchesLine ? matchesLine.lineSubtotal : rawLineTotal

        // Bloque POS-01: el boton "+" (o el limite de peso) se deshabilita
        // al llegar al stock disponible — mismo dato (`product.stock`) que
        // ya trae cada linea, sin ninguna consulta nueva. Productos sin
        // control de inventario (`trackInventory: false`) o sin dato de
        // stock para la sucursal actual (`stock: null`) nunca llegan a
        // este tope.
        const availableStock = line.product.stock?.quantity
        const atStockLimit =
          line.product.trackInventory && availableStock != null && line.quantity >= availableStock

        // Mismo dato/regla que ya usa `StockStatusBadge.tsx` — aca solo se
        // decide si vale la pena mostrar un chip de aviso ademas del
        // stepper (que ya bloqueaba "+" en el mismo caso).
        const stockStatus =
          line.product.trackInventory && line.product.stock
            ? resolveStockStatus(line.product.stock.quantity, line.product.stock.reorderPoint)
            : undefined
        const hasStockWarning = stockStatus === 'critical' || stockStatus === 'low'

        return (
          <li
            key={line.product.id}
            className="flex flex-col gap-2 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 hover:border-brand/40"
          >
            <div className="flex items-center gap-3.5">
              <ProductThumbnail
                imageUrl={line.product.imageUrl}
                title={line.product.name}
                containerClassName="h-11 aspect-[4/3] shrink-0 rounded-lg"
                textClassName="text-base text-brand/45"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold leading-tight text-[var(--pos-ink)]">
                  {line.product.name}
                </span>
                <span className="flex items-center gap-1.5 text-[0.625rem] font-normal text-[var(--pos-ink-muted)]/80">
                  {line.product.sku && (
                    <span className="truncate font-mono">{line.product.sku}</span>
                  )}
                  <span className="shrink-0">
                    {formatCurrency(line.product.salePrice)} {isWeighted ? '/kg' : 'c/u'}
                  </span>
                </span>
              </div>

              {readOnly ? (
                // Modo Cobrar (aprobado): cantidad/peso de solo lectura,
                // sin ningun control interactivo.
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-bg)] px-2 py-1 text-xs font-bold tabular-nums text-[var(--pos-ink)]">
                  {isWeighted && <Scale className="size-3 shrink-0" />}
                  {isWeighted ? formatQuantity(line.quantity, 'KILOGRAM') : line.quantity}
                </span>
              ) : isWeighted ? (
                // Peso variable (aprobado): sin stepper +/-1 — el peso se
                // carga/edita siempre via `ProductWeightDialog.tsx`.
                <button
                  type="button"
                  onClick={() => onEditWeight?.(line.product.id)}
                  title="Editar peso"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-bg)] px-2 py-1 text-xs font-bold tabular-nums text-[var(--pos-ink)] transition-colors hover:border-brand/50 hover:text-brand"
                >
                  <Scale className="size-3 shrink-0" />
                  {formatQuantity(line.quantity, 'KILOGRAM')}
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Disminuir cantidad de ${line.product.name}`}
                    onClick={() => onDecrease(line.product.id)}
                    className="border-[var(--pos-border)] bg-[var(--pos-bg)] text-[var(--pos-ink)] hover:border-brand/40"
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <EditableQuantity
                    productId={line.product.id}
                    quantity={line.quantity}
                    maxQuantity={line.product.trackInventory ? availableStock : undefined}
                    onSetQuantity={onSetQuantity}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Aumentar cantidad de ${line.product.name}`}
                    title={atStockLimit ? 'Sin más stock disponible' : undefined}
                    disabled={atStockLimit}
                    onClick={() => onIncrease(line.product.id)}
                    className="border-[var(--pos-border)] bg-[var(--pos-bg)] text-[var(--pos-ink)] hover:border-brand/40"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              )}

              <div className="flex w-[5rem] shrink-0 flex-col items-end">
                {hasPromotion && (
                  <span className="text-[0.625rem] text-[var(--pos-ink-muted)] line-through">
                    {formatCurrency(rawLineTotal)}
                  </span>
                )}
                <span
                  className={cn(
                    'text-right text-base font-extrabold tabular-nums text-[var(--pos-ink)]',
                    hasPromotion && 'text-accent-amber',
                  )}
                >
                  {formatCurrency(displayedLineTotal)}
                </span>
              </div>

              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${line.product.name} del carrito`}
                  onClick={() => onRemove(line.product.id)}
                  className="shrink-0 text-[var(--pos-ink-muted)] hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>

            {(hasPromotion || hasStockWarning) && (
              <div className="flex flex-wrap items-center gap-1.5 pl-[3.5rem]">
                {hasPromotion && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-amber/15 px-2 py-0.5 text-[0.625rem] font-semibold text-accent-amber">
                    <Tag className="size-2.5" />
                    Promoción aplicada
                  </span>
                )}
                {hasStockWarning && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold',
                      stockStatus === 'critical'
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-accent-amber/15 text-accent-amber',
                    )}
                  >
                    <TriangleAlert className="size-2.5" />
                    {stockStatus === 'critical' ? 'Última existencia' : 'Stock bajo'}
                  </span>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
