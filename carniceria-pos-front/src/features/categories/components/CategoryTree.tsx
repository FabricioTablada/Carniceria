import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, FolderTree } from 'lucide-react'
import { resolveCategoryColor } from '@/lib/categoryColor'
import { cn } from '@/lib/utils'
import { CategoryLowStockIndicator } from './CategoryLowStockIndicator'
import { CategoryProductCount } from './CategoryProductCount'
import { CategoryStatusBadge } from './CategoryStatusBadge'
import type { Category } from '../types/category.types'

interface CategoryTreeProps {
  /** Lista COMPLETA sin filtrar (misma consulta que ya se pedía para el
   * selector "Categoría padre" de `CategoryFilters.tsx`) — un árbol
   * necesita la jerarquía completa para armarse bien; filtrarla dejaría
   * huérfanas a subcategorías cuyo padre no cumple el filtro activo. */
  categories: Category[]
  onRowClick: (category: Category) => void
  emptyMessage?: ReactNode
  /** Workspace Categorías (aprobado): sin borde/sombra/rounded propios
   * para vivir dentro del mismo Workspace único que la vista Lista, en
   * vez de ser una superficie flotante aparte — mismo criterio y mismo
   * default (`false`) ya usado en `ProductsTableSkeleton.tsx`/
   * `CategoriesTableSkeleton.tsx`. */
  bare?: boolean
}

interface TreeNode {
  category: Category
  children: TreeNode[]
}

/** Agrupa el listado plano en un bosque de nodos por `parentId` — mismo
 * dato que ya llega hoy, ninguna consulta nueva. Recursivo: no asume un
 * único nivel de profundidad (el backend no limita cuántos niveles de
 * `parentId` puede tener una categoría). */
function buildForest(categories: Category[]): TreeNode[] {
  const nodesById = new Map<string, TreeNode>(
    categories.map((category) => [category.id, { category, children: [] }]),
  )
  const roots: TreeNode[] = []

  for (const node of nodesById.values()) {
    const parentId = node.category.parentId
    const parentNode = parentId ? nodesById.get(parentId) : undefined

    if (parentNode) {
      parentNode.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function TreeRow({
  node,
  depth,
  onRowClick,
}: {
  node: TreeNode
  depth: number
  onRowClick: (category: Category) => void
}) {
  // Mejora aprobada: raíces expandidas por defecto (el primer nivel es lo
  // que da contexto de un vistazo), subniveles colapsados para no abrumar
  // catálogos grandes.
  const [expanded, setExpanded] = useState(depth === 0)
  const { category, children } = node
  const color = resolveCategoryColor(category)
  const hasChildren = children.length > 0

  return (
    <>
      <div
        className="flex cursor-pointer items-center gap-2.5 border-b border-border py-2.5 pr-3 text-sm last:border-0 hover:bg-brand/5"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => onRowClick(category)}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((value) => !value)
          }}
          aria-label={expanded ? 'Contraer' : 'Expandir'}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted',
            !hasChildren && 'invisible',
          )}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{ ...color.tint, ...color.text }}
        >
          <FolderTree className="size-3.5" />
        </div>

        <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{category.name}</span>

        <CategoryStatusBadge active={category.active} />

        {hasChildren && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {children.length} subcategoría{children.length === 1 ? '' : 's'}
          </span>
        )}

        <span className="shrink-0 text-xs text-muted-foreground">
          <CategoryProductCount categoryId={category.id} /> productos
        </span>

        <CategoryLowStockIndicator categoryId={category.id} />
      </div>

      {expanded &&
        children.map((child) => (
          <TreeRow key={child.category.id} node={child} depth={depth + 1} onRowClick={onRowClick} />
        ))}
    </>
  )
}

/**
 * features/categories/components/CategoryTree.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Categorías (workspace, aprobado): vista alternativa a
 * `CategoriesTable.tsx` que muestra la jerarquía real (`parentId`/`parent`)
 * en vez de una fila plana por categoría. Mismo click de fila que la tabla
 * (`onRowClick` abre `CategoryDrawer.tsx`) — la navegación y el resto de
 * las acciones (editar, activar/desactivar, eliminar) siguen viviendo
 * exclusivamente en la vista Lista (`CategoriesTable.tsx`, sin cambios) y
 * en el Drawer; este árbol es de exploración/navegación, no reemplaza la
 * tabla ni duplica sus acciones.
 */
export function CategoryTree({ categories, onRowClick, emptyMessage, bare = false }: CategoryTreeProps) {
  const forest = buildForest(categories)

  if (forest.length === 0) {
    return <>{emptyMessage}</>
  }

  return (
    <div className={cn(!bare && 'rounded-xl border border-border/60 bg-card shadow-sm')}>
      {forest.map((node) => (
        <TreeRow key={node.category.id} node={node} depth={0} onRowClick={onRowClick} />
      ))}
    </div>
  )
}
