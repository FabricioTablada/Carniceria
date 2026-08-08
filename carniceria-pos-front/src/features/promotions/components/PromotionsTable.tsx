import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Banknote, Eye, Pencil, Percent, Repeat2, Sparkles, Tag, Trash2 } from 'lucide-react'
import { Can } from '@/components/common/Can'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { Switch } from '@/components/ui/switch'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { useDeletePromotion } from '../hooks/useDeletePromotion'
import { buildScopePhrase } from '../utils/promotionNarrative'
import { getPromotionErrorMessage } from '../utils/promotionErrors'
import type { Promotion, PromotionEffectType } from '../types/promotion.types'

interface PromotionsTableProps {
  /** Promociones a mostrar. La tabla no obtiene datos por si misma. */
  promotions: Promotion[]
  /** Contenido mostrado cuando `promotions` esta vacio — texto simple o
   * `EmptyState` (mismo criterio que el resto de las tablas del sprint). */
  emptyMessage?: ReactNode
  /** Se dispara al hacer click sobre una fila — abre el Drawer de vista
   * rapida (`PromotionDrawer.tsx`). */
  onRowClick?: (promotion: Promotion) => void
  /** Se dispara al presionar la accion de editar una promocion. */
  onEdit?: (promotion: Promotion) => void
  /** Se dispara al confirmar la accion de activar/desactivar una promocion. */
  onToggleStatus?: (promotion: Promotion) => void
  /** IDs seleccionados actualmente. Omitir desactiva la columna de
   * checkboxes (mismo criterio que el resto de las tablas del sprint). */
  selectedIds?: string[]
  /** Se dispara con el nuevo set de IDs seleccionados. */
  onSelectionChange?: (ids: string[]) => void
}

const EFFECT_ICONS: Record<PromotionEffectType, typeof Percent> = {
  PERCENTAGE: Percent,
  FIXED_AMOUNT: Banknote,
  SPECIAL_PRICE: Sparkles,
  FIXED_PRICE: Tag,
  BUY_X_PAY_Y: Repeat2,
}

const SCOPE_TYPE_LABELS: Record<Promotion['scopeType'], string> = {
  PRODUCT: 'Producto',
  CATEGORY: 'Categoría',
  COMBO: 'Combo',
  CART: 'Carrito completo',
}

/** Version corta del beneficio para la tabla — sin repetir "en X" (ya lo
 * dice la columna "Promoción"), a diferencia de la oracion completa que
 * usan el Resumen/Drawer (`buildEffectSentence`). */
function formatEffectShort(promotion: Promotion): string {
  if (promotion.effectType === 'BUY_X_PAY_Y') {
    return promotion.buyQuantity && promotion.payQuantity
      ? `Compra ${promotion.buyQuantity}, paga ${promotion.payQuantity}`
      : '—'
  }

  if (promotion.effectValue == null) {
    return '—'
  }

  return promotion.effectType === 'PERCENTAGE'
    ? `${promotion.effectValue}%`
    : formatCurrency(promotion.effectValue)
}

/** Workspace Promociones (aprobado): valor comparable del "Beneficio"
 * para el nuevo ordenamiento de columnas — puramente de presentación, no
 * altera ningun calculo de negocio. `BUY_X_PAY_Y` no tiene un
 * `effectValue` propio, asi que se aproxima por la fraccion que paga el
 * cliente (menor = mejor beneficio), mismo criterio informal que ya usa
 * `formatEffectShort` para mostrarlo. */
function getBenefitSortValue(promotion: Promotion): number {
  if (promotion.effectType === 'BUY_X_PAY_Y') {
    return promotion.buyQuantity && promotion.payQuantity
      ? promotion.payQuantity / promotion.buyQuantity
      : 0
  }

  return promotion.effectValue ?? 0
}

function formatVigencia(promotion: Promotion): string {
  if (!promotion.startDate && !promotion.endDate) {
    return 'Sin límite'
  }

  const start = promotion.startDate?.slice(0, 10) ?? '—'
  const end = promotion.endDate?.slice(0, 10) ?? '—'
  return `${start} a ${end}`
}

/** Workspace Promociones (aprobado): valor comparable de "Vigencia" para
 * el ordenamiento — por fecha de inicio; "Sin límite" (sin `startDate`)
 * ordena al final en ascendente, mismo criterio intuitivo de "sin fecha
 * = indefinido, no antes que las fechas reales". */
function getVigenciaSortValue(promotion: Promotion): number {
  return promotion.startDate ? new Date(promotion.startDate).getTime() : Number.MAX_SAFE_INTEGER
}

/** Workspace Promociones (aprobado, "Prioridad con mayor jerarquía
 * visual"): 4 niveles puramente visuales sobre el mismo
 * `promotion.priority` de siempre (sin tocar su significado ni su
 * validación, `0` en adelante, sin tope) — 0 = sin prioridad especial
 * (tono neutro), 1-4/5-9/10+ = niveles crecientes de énfasis, mismos
 * tokens de color ya usados en el resto del Design System. */
function getPriorityTone(priority: number): { className: string } {
  if (priority <= 0) {
    return { className: 'bg-muted text-muted-foreground' }
  }
  if (priority < 5) {
    return { className: 'bg-accent-teal/15 text-accent-teal' }
  }
  if (priority < 10) {
    return { className: 'bg-accent-amber/15 text-accent-amber' }
  }
  return { className: 'bg-brand/15 text-brand' }
}

/**
 * features/promotions/components/PromotionsTable.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — rediseño de Promociones sobre el mismo
 * estandar que Productos/Categorías/Impuestos/Proveedores. "Promoción"
 * fusiona nombre + a que aplica (icono segun `effectType`, subtexto con
 * `buildScopePhrase` — mismo texto que usan Resumen/Drawer). "Beneficio"
 * se destaca visualmente (como el precio en Productos) en vez de dos
 * lineas de texto plano. `RowMenu`: "Ver detalle" (abre el Drawer),
 * "Editar", "Eliminar".
 *
 * Workspace Promociones (aprobado):
 * - "Prioridad" pasa a ser visible en la tabla (antes solo en el
 *   Drawer) — chip compacto `P{n}` (mismo ancho para cualquier numero de
 *   digitos), coloreado por nivel (`getPriorityTone`, puramente visual).
 * - "Estado" reemplaza el badge de solo lectura por el mismo patron
 *   Switch+chip de `ProductsTable.tsx`/`CategoriesTable.tsx`/
 *   `TaxesTable.tsx` — mismo comportamiento (abre el mismo
 *   `ConfirmDialog` de siempre). El item "Activar/Desactivar" del
 *   `RowMenu` se retira: quedaria duplicado con el Switch.
 * - Ordenamiento por columna (Promoción/Beneficio/Vigencia/Prioridad/
 *   Estado) — primer consumidor real del nuevo `column.sortValue` de
 *   `DataTable.tsx` (ver su comentario de archivo, "nuevo estandar para
 *   todo el ERP"). Orden inicial: Promoción ascendente.
 * - `tableClassName` sin borde/sombra propios — el Workspace unico de
 *   `PromotionsPage.tsx` los aporta.
 *
 * "Eliminar" (bloque de borrado logico, mismo patron ya aprobado en
 * `features/categories/components/CategoriesTable.tsx`): a diferencia de
 * "Activar/Desactivar" (mutacion propiedad de `PromotionsPage.tsx`, sin
 * feedback de exito/error), esta tabla llama a `useDeletePromotion()`
 * directamente. El dialogo de confirmacion permanece abierto con
 * `loading` mientras la mutacion esta en curso, se cierra solo al tener
 * exito, y el error se traduce con `getPromotionErrorMessage` y se
 * muestra en un `toast.error` sin cerrar el dialogo — el usuario puede
 * reintentar o cancelar. Gated por
 * `<Can permission={PERMISSIONS.PROMOTIONS_DELETE}>`: el backend ya
 * rechaza la peticion sin ese permiso (`promotions.delete` en
 * `authorizePermission`), este `<Can>` solo oculta la opcion en la UI.
 */
export function PromotionsTable({
  promotions,
  emptyMessage = 'No hay promociones para mostrar.',
  onRowClick,
  onEdit,
  onToggleStatus,
  selectedIds,
  onSelectionChange,
}: PromotionsTableProps) {
  const [pendingToggle, setPendingToggle] = useState<Promotion | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Promotion | null>(null)
  const { mutate: deletePromotion, isPending: isDeleting } = useDeletePromotion()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission(PERMISSIONS.PROMOTIONS_UPDATE)

  const handleToggleStatusClick = (promotion: Promotion) => {
    setPendingToggle(promotion)
  }

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    onToggleStatus?.(pendingToggle)
    setPendingToggle(null)
  }

  const handleDeleteClick = (promotion: Promotion) => {
    setPendingDelete(promotion)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    deletePromotion(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`Promoción "${pendingDelete.name}" eliminada correctamente.`)
        setPendingDelete(null)
      },
      onError: (error) => {
        toast.error(getPromotionErrorMessage(error))
      },
    })
  }

  const columns: DataTableColumn<Promotion>[] = [
    {
      header: 'Promoción',
      sortValue: (promotion) => promotion.name,
      render: (promotion) => {
        const Icon = EFFECT_ICONS[promotion.effectType]
        const names =
          promotion.scopeType === 'CATEGORY'
            ? promotion.categories.map((item) => item.category.name)
            : promotion.products.map((item) => item.product.name)

        return (
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-semibold text-foreground">
                {promotion.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {SCOPE_TYPE_LABELS[promotion.scopeType]}
                {promotion.scopeType !== 'CART' &&
                  ` · ${buildScopePhrase({ scopeType: promotion.scopeType, selectedNames: names })}`}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      header: 'Beneficio',
      sortValue: getBenefitSortValue,
      render: (promotion) => formatEffectShort(promotion),
      className: 'text-right text-base font-bold tabular-nums text-brand',
      headerClassName: 'text-right',
    },
    {
      header: 'Vigencia',
      sortValue: getVigenciaSortValue,
      render: (promotion) => formatVigencia(promotion),
      className: 'text-muted-foreground',
    },
    {
      header: 'Prioridad',
      sortValue: (promotion) => promotion.priority,
      headerClassName: 'text-center',
      render: (promotion) => {
        const tone = getPriorityTone(promotion.priority)

        return (
          <div className="flex justify-center">
            <span
              className={cn(
                'inline-flex w-9 shrink-0 items-center justify-center rounded-full py-0.5 font-mono text-[0.6875rem] font-bold',
                tone.className,
              )}
            >
              P{promotion.priority}
            </span>
          </div>
        )
      },
      className: 'text-center',
    },
    {
      header: 'Estado',
      sortValue: (promotion) => (promotion.active ? 1 : 0),
      headerClassName: 'min-w-[9.5rem] text-center',
      render: (promotion) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-4 py-2',
              promotion.active ? 'bg-success/8' : 'bg-destructive/8',
            )}
          >
            <Switch
              checked={promotion.active}
              disabled={!canUpdate}
              title={!canUpdate ? 'No tenés permiso para cambiar el estado de una promoción.' : undefined}
              onCheckedChange={() => handleToggleStatusClick(promotion)}
              aria-label={promotion.active ? `Desactivar ${promotion.name}` : `Activar ${promotion.name}`}
              className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
            />
            <span
              className={cn(
                'text-sm font-medium',
                promotion.active ? 'text-success' : 'text-destructive',
              )}
            >
              {promotion.active ? 'Activa' : 'Inactiva'}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[9.5rem] align-middle',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (promotion) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <div className="hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => onRowClick?.(promotion)}
              aria-label={`Ver detalle de ${promotion.name}`}
              title="Ver detalle"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
            <Can permission={PERMISSIONS.PROMOTIONS_UPDATE}>
              <button
                type="button"
                onClick={() => onEdit?.(promotion)}
                aria-label={`Editar ${promotion.name}`}
                title="Editar"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </Can>
          </div>
          <RowMenu label={`Acciones para ${promotion.name}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(promotion)}>
              Ver detalle
            </RowMenuItem>
            <Can permission={PERMISSIONS.PROMOTIONS_UPDATE}>
              <RowMenuItem icon={Pencil} onClick={() => onEdit?.(promotion)}>
                Editar
              </RowMenuItem>
            </Can>
            <Can permission={PERMISSIONS.PROMOTIONS_DELETE}>
              <RowMenuItem
                icon={Trash2}
                destructive
                onClick={() => handleDeleteClick(promotion)}
              >
                Eliminar
              </RowMenuItem>
            </Can>
          </RowMenu>
        </div>
      ),
      className: 'w-24 align-middle',
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={promotions}
        getRowKey={(promotion) => promotion.id}
        emptyMessage={emptyMessage}
        tableClassName="rounded-none border-0 shadow-none"
        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
        rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
        cellClassName="px-4 py-2.5"
        selectable
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        initialSort={{ header: 'Promoción', direction: 'asc' }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={pendingToggle?.active ? 'Desactivar promoción' : 'Activar promoción'}
        description={
          pendingToggle
            ? pendingToggle.active
              ? `¿Seguro que querés desactivar "${pendingToggle.name}"?`
              : `¿Seguro que querés activar "${pendingToggle.name}"?`
            : undefined
        }
        confirmText={pendingToggle?.active ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
        onConfirm={handleConfirmToggle}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title="Eliminar promoción"
        description={
          pendingDelete
            ? `¿Seguro que querés eliminar "${pendingDelete.name}"? Esta acción no se puede deshacer desde esta pantalla.`
            : undefined
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
