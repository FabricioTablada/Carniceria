import { useState } from 'react'
import { toast } from 'sonner'
import { Banknote, Percent, Repeat2, Sparkles, Tag, type LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'
import { Can } from '@/components/common/Can'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@/constants/permissions'
import { useUpdatePromotionStatus } from '@/features/promotions/hooks/useUpdatePromotionStatus'
import { buildEffectSentence } from '@/features/promotions/utils/promotionNarrative'
import { PromotionCard } from './PromotionCard'
import type {
  Promotion,
  PromotionEffectType,
  PromotionScopeType,
} from '@/features/promotions/types/promotion.types'

interface PromotionsActivationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** TODAS las promociones del sistema (activas e inactivas) — a
   * diferencia de `PromotionsAvailableDialog.tsx` (solo activas, de solo
   * lectura), este dialogo necesita ver el catalogo completo para poder
   * activar una que hoy esta inactiva. */
  promotions: Promotion[]
}

const EFFECT_ICONS: Record<PromotionEffectType, LucideIcon> = {
  PERCENTAGE: Percent,
  FIXED_AMOUNT: Banknote,
  SPECIAL_PRICE: Sparkles,
  FIXED_PRICE: Tag,
  BUY_X_PAY_Y: Repeat2,
}

const EFFECT_TYPE_LABELS: Record<PromotionEffectType, string> = {
  PERCENTAGE: 'Porcentaje',
  FIXED_AMOUNT: 'Monto fijo',
  SPECIAL_PRICE: 'Precio especial',
  FIXED_PRICE: 'Precio fijo',
  BUY_X_PAY_Y: 'Compra X, paga Y',
}

const SCOPE_TYPE_LABELS: Record<PromotionScopeType, string> = {
  PRODUCT: 'Producto',
  CATEGORY: 'Categoría',
  COMBO: 'Combo',
  CART: 'Carrito completo',
}

/** Mismo helper ya usado en `PromotionsAvailableDialog.tsx` — nombres ya
 * resueltos (producto/categoria) para `buildEffectSentence`, sin pedir
 * nada nuevo (mismos campos que ya trae `GET /promotions`). */
function resolveScopeNames(promotion: Promotion): string[] {
  if (promotion.scopeType === 'PRODUCT' || promotion.scopeType === 'COMBO') {
    return promotion.products.map((item) => item.product.name)
  }

  if (promotion.scopeType === 'CATEGORY') {
    return promotion.categories.map((item) => item.category.name)
  }

  return []
}

/**
 * features/sales/components/PromotionsActivationDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque POS-05: unico punto del POS con capacidad de ACTIVAR/DESACTIVAR una
 * promocion, sin salir al modulo administrativo. A diferencia de
 * `PromotionsAvailableDialog.tsx` (de solo lectura, solo promociones
 * activas, pensado para ver que se aplico a ESTA venta), este dialogo
 * muestra el catalogo COMPLETO (activas e inactivas, cada una con su
 * estado) y reutiliza exactamente el mismo mecanismo de activacion que ya
 * usa el modulo administrativo (`useUpdatePromotionStatus` ->
 * `PATCH /promotions/:id/status`, mismo hook/endpoint que
 * `PromotionsTable.tsx`/`PromotionsPage.tsx`), incluyendo el mismo patron
 * de confirmacion (`pendingToggle` + `ConfirmDialog`) — sin duplicar esa
 * logica con una version propia.
 *
 * Sin ninguna regla nueva de exclusividad: activar una promocion no
 * desactiva ninguna otra (el motor de reglas — `priority`/`stackable`/
 * `exclusiveGroup` — sigue siendo exclusivo del backend/`PromotionEngine`,
 * sin cambios). Si el cajero no quiere que convivan varias promociones
 * activas, las desactiva el mismo, manualmente, desde esta misma lista.
 *
 * Pulido visual final del POS (aprobado, "modal de Promociones — mismo
 * switch moderno que Productos/Usuarios/Roles"): el botón "Activar/
 * Desactivar" se reemplaza por el mismo `Switch` inline (chip verde/rojo,
 * `data-[checked]:bg-success data-[unchecked]:bg-destructive`) ya usado en
 * `ProductsTable.tsx`/`UsersTable.tsx`/`RolesTable.tsx` — sigue abriendo el
 * MISMO `ConfirmDialog`/`pendingToggle` de siempre, nunca aplica el cambio
 * directamente. `max-w-lg` -> `max-w-xl`, encabezado con banda `bg-muted/40`
 * y cada fila pasa a `PromotionCard.tsx` (compartida con
 * `PromotionsAvailableDialog.tsx`).
 */
export function PromotionsActivationDialog({
  open,
  onOpenChange,
  promotions,
}: PromotionsActivationDialogProps) {
  const { mutate: updatePromotionStatus, isPending } = useUpdatePromotionStatus()
  const [pendingToggle, setPendingToggle] = useState<Promotion | null>(null)

  const handleConfirmToggle = () => {
    if (!pendingToggle) {
      return
    }

    const nextActive = !pendingToggle.active
    const promotionName = pendingToggle.name

    updatePromotionStatus(
      { id: pendingToggle.id, dto: { active: nextActive } },
      {
        // Bloque POS-08: antes esto era completamente silencioso (ni
        // exito ni error mostraban nada — un fallo se veia identico a un
        // exito). Este dialogo no tenia ningun `ErrorAlert` que
        // "conservar": el toast es la unica correccion necesaria.
        onSuccess: () => {
          toast.success(nextActive ? 'Promoción activada' : 'Promoción desactivada', {
            description: promotionName,
          })
        },
        onError: () => {
          toast.error('No se pudo actualizar la promoción', {
            description: promotionName,
          })
        },
      },
    )
    setPendingToggle(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0 p-0">
          <div className="flex items-center gap-3.5 border-b bg-muted/40 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Tag className="size-5" />
            </span>
            <DialogHeader>
              <DialogTitle className="text-lg">Promociones</DialogTitle>
              <DialogDescription>
                Activá o desactivá promociones sin salir del POS.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
            {promotions.length === 0 && (
              <EmptyState
                icon={Tag}
                title="No hay promociones registradas"
                description="Todavía no se creó ninguna promoción en el sistema."
              />
            )}

            {promotions.map((promotion) => {
              const EffectIcon = EFFECT_ICONS[promotion.effectType]
              const benefit = buildEffectSentence({
                scopeType: promotion.scopeType,
                effectType: promotion.effectType,
                effectValue: promotion.effectValue,
                buyQuantity: promotion.buyQuantity,
                payQuantity: promotion.payQuantity,
                selectedNames: resolveScopeNames(promotion),
              })

              return (
                <PromotionCard
                  key={promotion.id}
                  name={promotion.name}
                  icon={EffectIcon}
                  effectLabel={EFFECT_TYPE_LABELS[promotion.effectType]}
                  scopeLabel={SCOPE_TYPE_LABELS[promotion.scopeType]}
                  benefit={benefit}
                  highlighted={promotion.active}
                  statusSlot={
                    <Can permission={PERMISSIONS.PROMOTIONS_UPDATE}>
                      <div
                        className={cn(
                          'flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1',
                          promotion.active ? 'bg-success/10' : 'bg-destructive/10',
                        )}
                      >
                        <Switch
                          checked={promotion.active}
                          disabled={isPending}
                          onCheckedChange={() => setPendingToggle(promotion)}
                          aria-label={promotion.active ? `Desactivar ${promotion.name}` : `Activar ${promotion.name}`}
                          className="data-[checked]:bg-success data-[unchecked]:bg-destructive"
                        />
                        <ActiveStatusBadge active={promotion.active} />
                      </div>
                    </Can>
                  }
                />
              )
            })}
          </div>

          <DialogFooter className="border-t p-4 sm:justify-between">
            <p className="text-xs text-muted-foreground sm:max-w-72">
              Activar o desactivar una promoción no afecta a las demás — cada
              una mantiene su propio estado.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  )
}
