import { MediaCard } from '@/components/ui/MediaCard'
import { StockStatusBadge } from '@/components/common/StockStatusBadge'
import { formatCurrency } from '@/utils/formatCurrency'
import { resolveStockStatus } from '@/utils/stockStatus'
import type { Product } from '@/features/products/types/product.types'

interface ProductCatalogCardProps {
  product: Product
  onSelect?: (product: Product) => void
  /** Rediseño del POS (aprobado, "catálogo inteligente"): rótulo corto de
   * la tarjeta — "En promoción" (cruzando el catálogo de promociones ya
   * cargado por `SalesPOSPage.tsx` contra este producto) o "Top" (viene
   * del ranking de `GET /reports/top-products`, ya usado en Reportes).
   * Ambos opcionales/aditivos: sin ellos, la tarjeta se ve igual que
   * siempre. Mutuamente excluyentes por prioridad (promoción gana sobre
   * "Top" si un producto tiene ambos — un solo rótulo por tarjeta, sin
   * amontonar). */
  isOnPromotion?: boolean
  isTopSeller?: boolean
  /** Favorito (preferencia local del cajero, ver `useFavoriteProducts.ts`),
   * sin dato de negocio nuevo. */
  isFavorite?: boolean
  onToggleFavorite?: (productId: string) => void
}

/**
 * features/sales/components/ProductCatalogCard.tsx
 * -----------------------------------------------------------------------------
 * Una tarjeta de catalogo del POS, con su stock real debajo del precio.
 *
 * Fase 18 (Bloque 18.3): el stock ya NO se consulta por tarjeta. Hasta este
 * bloque, cada tarjeta llamaba a su propia instancia de `useInventory`
 * (`GET /inventory?sucursalId=&productId=`) — con el catalogo en ~100
 * productos visibles a la vez, eso eran ~100 peticiones HTTP independientes
 * por cada carga de la pantalla del POS (patron N+1 diagnosticado en la
 * Fase 18). Ahora el stock viaja embebido en `product.stock`, ya incluido
 * en la MISMA respuesta de `GET /products?sucursalId=...` que trae el
 * catalogo completo (ver `SalesPOSPage.tsx`, Bloque 18.2, y
 * `products.repository.ts` del backend, Bloque 18.1) — cero peticiones
 * adicionales, sin importar cuantas tarjetas se rendericen.
 *
 * Bloque POS-02 (gestion inteligente de stock): el caption de texto plano
 * ("X disp.") se reemplaza por `StockStatusBadge` (`components/common/`,
 * ya usado en la tabla de Inventario) — mismo dato (`product.stock`), sin
 * ninguna consulta nueva, ahora con color segun el punto de reorden
 * (`resolveStockStatus()`, compartido, sin logica duplicada aca).
 *
 * Rediseño del POS (aprobado, "catálogo inteligente"): `cornerBadge` de
 * `MediaCard` se resuelve acá con "Bajo stock" (mismo `resolveStockStatus`
 * que ya calculaba el badge de abajo, sin duplicar la regla) cuando no hay
 * ya un rótulo de promoción/top — sigue siendo UN solo rótulo por tarjeta.
 */
export function ProductCatalogCard({
  product,
  onSelect,
  isOnPromotion,
  isTopSeller,
  isFavorite,
  onToggleFavorite,
}: ProductCatalogCardProps) {
  const stockBadge =
    product.trackInventory && product.stock ? (
      <StockStatusBadge
        quantity={product.stock.quantity}
        unitOfMeasure={product.unitOfMeasure}
        reorderPoint={product.stock.reorderPoint}
      />
    ) : undefined

  const stockStatus =
    product.trackInventory && product.stock
      ? resolveStockStatus(product.stock.quantity, product.stock.reorderPoint)
      : undefined
  const isLowStock = stockStatus === 'critical' || stockStatus === 'low'

  const cornerBadge = isOnPromotion ? 'Promoción' : isTopSeller ? 'Top ventas' : isLowStock ? 'Bajo stock' : undefined
  const cornerBadgeTone = isOnPromotion ? 'brand' : isTopSeller ? 'success' : 'warning'

  return (
    <MediaCard
      imageUrl={product.imageUrl}
      title={product.name}
      sku={product.sku}
      stockBadge={stockBadge}
      price={formatCurrency(product.salePrice)}
      actionLabel={`Agregar ${product.name}`}
      onAction={() => onSelect?.(product)}
      onClick={() => onSelect?.(product)}
      cornerBadge={cornerBadge}
      cornerBadgeTone={cornerBadgeTone}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(product.id) : undefined}
    />
  )
}
