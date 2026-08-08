import { PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { ProductCatalogCard } from './ProductCatalogCard'
import type { Product } from '@/features/products/types/product.types'

interface ProductResultsProps {
  products: Product[]
  emptyMessage?: string
  /** Se dispara cuando el usuario elige un producto de la lista. */
  onSelect?: (product: Product) => void
  /** `true` si `GET /products` todavia tiene mas resultados que los ya
   * traidos (`products.length < meta.total`, resuelto por
   * `SalesPOSPage.tsx` a partir del `meta` que ya devuelve el endpoint —
   * mismo campo que ya usan las tablas paginadas del resto del ERP).
   * Sin esto (o sin `onLoadMore`), no se muestra ningun boton. */
  hasMore?: boolean
  /** Pide mas resultados — `SalesPOSPage.tsx` sube el `limit` de la misma
   * consulta ya existente (`useProducts`), no crea una peticion nueva. */
  onLoadMore?: () => void
  /** `true` mientras la consulta con el `limit` ampliado esta en curso. */
  isLoadingMore?: boolean
  /** Rediseño del POS (aprobado, "catálogo inteligente"): sets de IDs para
   * los rótulos de cada tarjeta — ninguno es lógica nueva, todos ya
   * derivados por `SalesPOSPage.tsx` de datos ya cargados (promociones
   * activas, ranking de más vendidos) o de preferencia local (favoritos). */
  promotedProductIds?: Set<string>
  topSellerProductIds?: Set<string>
  favoriteProductIds?: Set<string>
  onToggleFavorite?: (productId: string) => void
}

/**
 * Interfaz publica identica a la version anterior (lista): mismos props,
 * mismo comportamiento de seleccion. Solo cambia el render interno, ahora
 * una grilla de `ProductCatalogCard` (con stock real) en vez de una lista
 * de filas.
 *
 * No muestra el badge Activo/Inactivo (a diferencia de la version anterior):
 * el catalogo del POS es para vender, no para administrar productos — mismo
 * criterio ya usado en el resto de la interfaz de venta.
 *
 * Fase 18 (Bloque 18.3): ya NO reenvia `sucursalId` a cada tarjeta —
 * `ProductCatalogCard` dejo de necesitarlo (el stock viene embebido en
 * `product.stock`, resuelto por `SalesPOSPage.tsx` al pedir el catalogo).
 *
 * Rediseño del POS (aprobado, "5 tarjetas por fila en Full HD, filas
 * siempre uniformes"): `grid-cols-6` -> `grid-cols-5` — mismo criterio de
 * "número fijo de columnas, sin auto-fill" ya vigente (decisión explícita
 * previa, no se reabre), solo cambia el número. `gap-3` -> `gap-2.5`:
 * tarjetas más compactas (ver `MediaCard.tsx`) piden un poco menos de aire
 * entre ellas para que la fila no se sienta más vacía que antes.
 */
export function ProductResults({
  products,
  emptyMessage = 'No se encontraron productos.',
  onSelect,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  promotedProductIds,
  topSellerProductIds,
  favoriteProductIds,
  onToggleFavorite,
}: ProductResultsProps) {
  if (products.length === 0) {
    return (
      <div className="px-4 py-16">
        <EmptyState
          icon={PackageSearch}
          title={emptyMessage}
          description="Probá con otro nombre, SKU o código de barras."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-5 gap-2.5">
        {products.map((product) => (
          <ProductCatalogCard
            key={product.id}
            product={product}
            onSelect={onSelect}
            isOnPromotion={promotedProductIds?.has(product.id)}
            isTopSeller={topSellerProductIds?.has(product.id)}
            isFavorite={favoriteProductIds?.has(product.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {hasMore && onLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="mx-auto flex items-center gap-2 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel)] px-2.5 py-1.5 text-xs font-semibold text-[var(--pos-ink)] transition-colors hover:border-brand/40 hover:text-brand disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoadingMore ? 'Cargando...' : 'Ver más productos'}
        </button>
      )}
    </div>
  )
}
