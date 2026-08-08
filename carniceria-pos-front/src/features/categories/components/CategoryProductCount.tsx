import { useProducts } from '@/features/products/hooks/useProducts'

interface CategoryProductCountProps {
  categoryId: string
}

/**
 * features/categories/components/CategoryProductCount.tsx
 * -----------------------------------------------------------------------------
 * Extraído de `CategoryDrawer.tsx` (rediseño de Categorías, workspace):
 * `CategoryTree.tsx` necesita exactamente el mismo dato por nodo — en vez
 * de duplicar el mismo `useProducts({ categoryId, limit: 1 })` en dos
 * archivos, se extrae a un componente propio y ambos lo importan.
 *
 * `useProducts` no acepta `enabled` (no se modifica ese hook en este
 * bloque) — por eso solo se monta cuando hace falta mostrar el dato
 * (dentro de `{category && (...)}` en el Drawer, o por cada nodo visible
 * del árbol).
 */
export function CategoryProductCount({ categoryId }: CategoryProductCountProps) {
  const { data, isLoading } = useProducts({ categoryId, limit: 1 })
  const count = data?.meta.total

  return <>{isLoading ? '—' : (count ?? 0)}</>
}
