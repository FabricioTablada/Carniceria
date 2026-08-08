import type { ReactNode } from 'react'
import { Banknote, Pencil, Percent, Repeat2, Sparkles, Tag } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Can } from '@/components/common/Can'
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
import { formatDateTime } from '@/utils/formatDateTime'
import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'
import { buildPromotionNarrative, buildScopePhrase } from '../utils/promotionNarrative'
import type { Promotion, PromotionEffectType } from '../types/promotion.types'

interface PromotionDrawerProps {
  /** Promocion a mostrar. `null` cierra el panel (mismo criterio que el
   * resto de los Drawers del sprint). */
  promotion: Promotion | null
  onOpenChange: (open: boolean) => void
  onEdit: (promotion: Promotion) => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

const EFFECT_ICONS: Record<PromotionEffectType, typeof Percent> = {
  PERCENTAGE: Percent,
  FIXED_AMOUNT: Banknote,
  SPECIAL_PRICE: Sparkles,
  FIXED_PRICE: Tag,
  BUY_X_PAY_Y: Repeat2,
}

const SCOPE_LABELS: Record<Promotion['scopeType'], string> = {
  PRODUCT: 'Producto',
  CATEGORY: 'Categoría',
  COMBO: 'Combo',
  CART: 'Carrito completo',
}

/**
 * features/promotions/components/PromotionDrawer.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — rediseño de Promociones. No existia ningun
 * Drawer para esta entidad — ver una promocion completa exigia abrir el
 * formulario de edicion entero. Construido sobre `WorkspacePanel.tsx`.
 *
 * A diferencia de los otros Drawers del sprint (Productos/Categorías/
 * Impuestos/Proveedores, que muestran una lista de campos), aca el
 * cuerpo principal es la MISMA oracion en lenguaje natural del Resumen
 * del formulario (`utils/promotionNarrative.ts`, compartido) — leer
 * "20% de descuento en Costilla de Cerdo, válida del 1 al 31 de
 * diciembre" es mas rapido que interpretar 6 campos tecnicos sueltos.
 * Debajo, el detalle estructurado para quien quiera precision exacta.
 *
 * `promotion.products`/`promotion.categories` ya vienen resueltos con
 * nombre por el backend (`PromotionResponse`) — sin peticion nueva.
 *
 * Footer — mismo patron ESTRUCTURAL de `ProductDrawer.tsx`/
 * `CategoryDrawer.tsx`/`TaxDrawer.tsx` (accion primaria a `w-full`,
 * secundarias debajo), adaptado: este Drawer solo tiene 2 acciones (no
 * 3 — no existe un "Ver productos" generico, el alcance varia entre
 * producto/categoria/combo/carrito), asi que "Cerrar" queda a `w-full`
 * tambien en vez de forzar un par `flex-1` artificial sin una segunda
 * accion con la que emparejarlo.
 */
export function PromotionDrawer({ promotion, onOpenChange, onEdit }: PromotionDrawerProps) {
  const Icon = promotion ? EFFECT_ICONS[promotion.effectType] : Percent

  const selectedNames = promotion
    ? promotion.scopeType === 'CATEGORY'
      ? promotion.categories.map((item) => item.category.name)
      : promotion.products.map((item) => item.product.name)
    : []

  const sentences = promotion
    ? buildPromotionNarrative({
        scopeType: promotion.scopeType,
        effectType: promotion.effectType,
        effectValue: promotion.effectValue,
        buyQuantity: promotion.buyQuantity,
        payQuantity: promotion.payQuantity,
        minQuantity: promotion.minQuantity,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        startTime: promotion.startTime,
        endTime: promotion.endTime,
        daysOfWeek: promotion.daysOfWeek,
        stackable: promotion.stackable,
        exclusiveGroup: promotion.exclusiveGroup,
        selectedNames,
      })
    : []

  return (
    <WorkspacePanel open={promotion !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {promotion && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {promotion.name}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {SCOPE_LABELS[promotion.scopeType]}
                </p>
              </div>
              <ActiveStatusBadge active={promotion.active} />
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section className="rounded-xl border border-brand/15 bg-brand/5 p-4">
                <p className="mb-1 text-xs font-semibold tracking-wide text-brand/70 uppercase">
                  Resumen
                </p>
                <ul className="flex flex-col gap-1 text-sm text-foreground">
                  {sentences.map((sentence) => (
                    <li key={sentence}>{sentence}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Alcance
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Aplica a" value={SCOPE_LABELS[promotion.scopeType]} />
                  {promotion.scopeType !== 'CART' && (
                    <InfoRow
                      label={promotion.scopeType === 'CATEGORY' ? 'Categorías' : 'Productos'}
                      value={buildScopePhrase({ scopeType: promotion.scopeType, selectedNames })}
                    />
                  )}
                </div>
              </section>

              {promotion.description && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Descripción
                  </h3>
                  <p className="text-sm text-foreground">{promotion.description}</p>
                </section>
              )}

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Reglas de combinación
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Prioridad" value={promotion.priority} />
                  <InfoRow
                    label="Combinable"
                    value={
                      promotion.stackable ? (
                        <Badge variant="accent">Sí</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )
                    }
                  />
                  {promotion.exclusiveGroup && (
                    <InfoRow label="Grupo de exclusión" value={promotion.exclusiveGroup} />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(promotion.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(promotion.updatedAt)} />
                </div>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter className="flex-col items-stretch gap-2 pt-4 pb-6 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.12)]">
              <Can permission={PERMISSIONS.PROMOTIONS_UPDATE}>
                <Button
                  type="button"
                  onClick={() => onEdit(promotion)}
                  className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                >
                  <Pencil className="size-4" />
                  Editar promoción
                </Button>
              </Can>
              <WorkspacePanelClose
                render={
                  <Button type="button" variant="outline" className="w-full">
                    Cerrar
                  </Button>
                }
              />
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
