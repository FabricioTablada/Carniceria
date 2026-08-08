import { useNavigate } from 'react-router-dom'
import { ArrowRight, FolderTree, Pencil } from 'lucide-react'
import { Can } from '@/components/common/Can'
import { CategoryBadge } from '@/components/common/CategoryBadge'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/constants/permissions'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { resolveCategoryColor } from '@/lib/categoryColor'
import { useLowStock } from '@/features/reports/hooks/useLowStock'
import { useSalesByCategory } from '@/features/reports/hooks/useSalesByCategory'
import { DashboardLowStockPanel } from '@/features/reports/components/DashboardLowStockPanel'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { CategoryProductCount } from './CategoryProductCount'
import { CategoryStatusBadge } from './CategoryStatusBadge'
import type { Category } from '../types/category.types'
import type { ReactNode } from 'react'

interface CategoryDrawerProps {
  /** Categoria a mostrar. `null` cierra el panel (mismo criterio que
   * `ProductDrawer.tsx`). */
  category: Category | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion —
   * mismo criterio que `ProductDrawer.tsx` (Decision A del sprint de
   * Productos: el Drawer nunca edita datos por si mismo). */
  onEdit: (category: Category) => void
  /** Rediseño de Categorías (workspace, aprobado): navega a Productos ya
   * filtrado por esta categoría (reutiliza `ProductFilters.categoryId`,
   * ya soportado — ver `ProductsPage.tsx`). */
  onViewProducts: (category: Category) => void
  /** Rediseño de Categorías (workspace, aprobado), opcional: si se provee,
   * el badge de "Categoría padre" se vuelve clickeable y navega
   * (reabre este mismo Drawer) sobre esa categoría padre — navegación
   * jerárquica sin cerrar el panel. Resuelto por `CategoriesPage.tsx` a
   * partir del mismo listado sin filtrar que ya alimenta el árbol/el
   * selector de "Categoría padre", sin ninguna consulta nueva. */
  onNavigateToParent?: (parentId: string) => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * features/categories/components/CategoryDrawer.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar de Productos (`ProductDrawer.tsx`) — no existia
 * ningun Drawer de Categoria antes de este bloque. Construido sobre
 * `WorkspacePanel.tsx` (mismo primitivo, no se reinventa), mismo criterio
 * de interaccion: click en una fila de `CategoriesTable.tsx` lo abre
 * (vista rapida primaria), la edicion completa es siempre una accion
 * explicita (boton "Editar categoría" aca, o "Editar" en el `RowMenu`).
 *
 * Sin miniatura (Categoria no tiene imagen): el icono `FolderTree` se
 * tinta con `getCategoryColor(category.id)` — mismo color que ya se ve en
 * la tabla/el badge de "Categoría padre" en otras pantallas.
 *
 * "Productos en esta categoría" es el unico dato que no viene directo de
 * `Category`: reutiliza `useProducts({ categoryId, limit: 1 })`
 * (`features/products/hooks`, ya existente — mismo endpoint que ya usa el
 * listado de Productos, sin filtro nuevo en el backend) solo por
 * `meta.total`, mismo criterio que "Inactivos" en `ProductsKpiRow.tsx`
 * (derivar de una consulta ya soportada, sin inventar un campo nuevo).
 *
 * Rediseño de Categorías (workspace, aprobado): dos secciones nuevas,
 * ambas reutilizando hooks ya construidos en otros bloques, sin ningún
 * endpoint nuevo:
 *  - "Productos con bajo stock": `useLowStock({ categoryId })` (mismo
 *    filtro ya soportado por `LowStockPage.tsx`/`InventoryAlertsPage.tsx`)
 *    + `DashboardLowStockPanel.tsx` (mismo componente del Dashboard,
 *    reutilizado tal cual).
 *  - "Ventas de esta categoría": `useSalesByCategory()` (ya construido
 *    para el Dashboard) — sin filtro por categoría en el backend (no
 *    tiene sentido en un reporte que agrupa POR categoría), se busca la
 *    fila correspondiente en el array ya traído.
 * Ambas viven en componentes locales (`CategoryLowStockSection`/
 * `CategorySalesSection`) montados solo dentro de `{category && (...)}`,
 * mismo criterio que `CategoryProductCount` — sus hooks no disparan
 * mientras el Drawer está cerrado.
 *
 * Footer — mismo patron ESTRUCTURAL ya aprobado en `ProductDrawer.tsx`
 * (no una solucion nueva): `WorkspacePanelFooter` con
 * `flex-col items-stretch gap-2 pt-4 pb-6 shadow-[...]` — fila 1,
 * "Editar categoría" a `w-full` (unica accion primaria); fila 2,
 * "Cerrar" y "Ver productos de esta categoría" con `flex-1` cada uno
 * (mismo ancho exacto). El efecto "sticky" (siempre visible, nunca
 * scrollea con el body) es el mismo de siempre: `WorkspacePanelFooter`
 * ya es `shrink-0` dentro del `flex-col` de `WorkspacePanelContent`, sin
 * `position: sticky` — no hay nada que "mantener" aca, es el
 * comportamiento por defecto del componente compartido.
 *
 * Header — la X: este Drawer nunca agrego una barra "Anterior/Siguiente"
 * (no tiene navegacion entre categorías como si tiene `ProductDrawer.tsx`),
 * asi que nunca estuvo expuesto al bug que se corrigio ahi (la X
 * `absolute` de `WorkspacePanelContent` chocando con esa barra). Con
 * `onNavigate` ausente, el comportamiento es exactamente el mismo "caso
 * sin barra" ya validado en `ProductDrawer.tsx`: X global, con el
 * `pr-14` que ya trae por defecto `WorkspacePanelHeader` — nada que
 * corregir aca, mismo patron por construccion.
 */
function CategoryLowStockSection({ categoryId }: { categoryId: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useLowStock({ categoryId })

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Productos con bajo stock
      </h3>
      <DashboardLowStockPanel
        items={data ?? []}
        isLoading={isLoading}
        onViewMore={() => navigate('/reports/low-stock')}
      />
    </section>
  )
}

function CategorySalesSection({ categoryId }: { categoryId: string }) {
  const { data, isLoading } = useSalesByCategory()
  const salesForCategory = data?.find((item) => item.categoryId === categoryId)

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Ventas de esta categoría
      </h3>
      <div className="divide-y divide-border">
        <InfoRow
          label="Importe vendido"
          value={isLoading ? '—' : formatCurrency(salesForCategory?.totalSalesAmount ?? 0)}
        />
        <InfoRow
          label="Unidades vendidas"
          value={isLoading ? '—' : (salesForCategory?.totalQuantitySold ?? 0)}
        />
      </div>
    </section>
  )
}

export function CategoryDrawer({
  category,
  onOpenChange,
  onEdit,
  onViewProducts,
  onNavigateToParent,
}: CategoryDrawerProps) {
  const color = category ? resolveCategoryColor(category) : null

  return (
    <WorkspacePanel open={category !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {category && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div
                className="flex size-16 shrink-0 items-center justify-center rounded-xl"
                style={color ? { ...color.tint, ...color.text } : undefined}
              >
                <FolderTree className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {category.name}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {category.parent ? `Subcategoría de ${category.parent.name}` : 'Categoría raíz'}
                </p>
              </div>
              <CategoryStatusBadge active={category.active} />
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Información general
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Categoría padre"
                    value={
                      category.parent ? (
                        onNavigateToParent ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToParent(category.parent!.id)}
                            className="cursor-pointer"
                          >
                            <CategoryBadge
                              categoryId={category.parent.id}
                              label={category.parent.name}
                              color={category.parent.color}
                            />
                          </button>
                        ) : (
                          <CategoryBadge
                            categoryId={category.parent.id}
                            label={category.parent.name}
                            color={category.parent.color}
                          />
                        )
                      ) : (
                        'Sin categoría padre'
                      )
                    }
                  />
                  <InfoRow label="Productos" value={<CategoryProductCount categoryId={category.id} />} />
                </div>
              </section>

              <CategoryLowStockSection categoryId={category.id} />
              <CategorySalesSection categoryId={category.id} />

              {category.description && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Descripción
                  </h3>
                  <p className="text-sm text-foreground">{category.description}</p>
                </section>
              )}

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(category.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(category.updatedAt)} />
                </div>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter className="flex-col items-stretch gap-2 pt-4 pb-6 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.12)]">
              <Can permission={PERMISSIONS.CATEGORIES_UPDATE}>
                <Button
                  type="button"
                  onClick={() => onEdit(category)}
                  className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                >
                  <Pencil className="size-4" />
                  Editar categoría
                </Button>
              </Can>
              <div className="flex items-center gap-2">
                <WorkspacePanelClose
                  render={
                    <Button type="button" variant="outline" className="flex-1">
                      Cerrar
                    </Button>
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onViewProducts(category)}
                  className="flex-1 gap-2"
                >
                  Ver productos de esta categoría
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
