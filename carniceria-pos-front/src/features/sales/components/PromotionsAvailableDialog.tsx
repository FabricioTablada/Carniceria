import { Banknote, Percent, Repeat2, Sparkles, Tag, type LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { buildEffectSentence } from '@/features/promotions/utils/promotionNarrative'
import { PromotionCard } from './PromotionCard'
import type { Promotion, PromotionEffectType, PromotionScopeType } from '@/features/promotions/types/promotion.types'
import type { CartLine } from './CartItems'

interface PromotionsAvailableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** TODAS las promociones activas (`GET /promotions?active=true`) — sin
   * resumir, ocultar ni elegir una: mismo listado que ya muestra la fila
   * de chips de `SalesPOSPage.tsx`, aca con el detalle completo. */
  promotions: Promotion[]
  /** `id` de las promociones que el motor YA aplico en la cotizacion
   * vigente (`quoteData.appliedPromotions`, `SaleQuoteAppliedPromotion.promotionId`) —
   * unica fuente de verdad de "aplicada", sin recalcular nada aca. */
  appliedPromotionIds: Set<string>
  /** Mismo carrito ya cargado — usado unicamente para calcular, cuando el
   * dato ya existe (`minQuantity`), si una promocion NO aplicada esta por
   * debajo de su cantidad minima. Ningun otro calculo. */
  cart: CartLine[]
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

/** Nombres ya resueltos (producto/categoria) para pasarle a
 * `buildEffectSentence` — mismos campos (`products`/`categories`) que ya
 * expone `GET /promotions`, sin pedir nada nuevo. */
function resolveScopeNames(promotion: Promotion): string[] {
  if (promotion.scopeType === 'PRODUCT' || promotion.scopeType === 'COMBO') {
    return promotion.products.map((item) => item.product.name)
  }

  if (promotion.scopeType === 'CATEGORY') {
    return promotion.categories.map((item) => item.category.name)
  }

  return []
}

/** Cantidad del carrito que cae dentro del alcance de la promocion — misma
 * data ya cargada (`cart`), solo se suma. `null` para COMBO: esa
 * combinacion (linea + `requiredQuantity` por producto) no tiene un
 * equivalente simple de "cantidad total", no se intenta adivinar. */
function matchingCartQuantity(promotion: Promotion, cart: CartLine[]): number | null {
  switch (promotion.scopeType) {
    case 'CART':
      return cart.reduce((sum, line) => sum + line.quantity, 0)
    case 'PRODUCT': {
      const productIds = new Set(promotion.products.map((item) => item.productId))
      return cart
        .filter((line) => productIds.has(line.product.id))
        .reduce((sum, line) => sum + line.quantity, 0)
    }
    case 'CATEGORY': {
      const categoryIds = new Set(promotion.categories.map((item) => item.categoryId))
      return cart
        .filter((line) => categoryIds.has(line.product.categoryId))
        .reduce((sum, line) => sum + line.quantity, 0)
    }
    default:
      return null
  }
}

/** Motivo por el que una promocion NO aplicada todavia no se activo —
 * UNICAMENTE cuando el dato ya existe y la cuenta es directa (cantidad
 * minima vs. cantidad ya en el carrito, mismo campo `minQuantity` que ya
 * muestra `buildConditionSentence` en el Resumen/Drawer de Promociones).
 * Sin ese dato, o para cualquier otro motivo real (prioridad, exclusividad
 * con otra promocion, stackable) que el backend no expone en la
 * cotizacion, devuelve `null` — el consumidor cae a "Disponible" en vez de
 * inventar una explicacion. */
function unmetReason(promotion: Promotion, cart: CartLine[]): string | null {
  if (promotion.minQuantity == null) {
    return null
  }

  const quantity = matchingCartQuantity(promotion, cart)
  if (quantity === null || quantity >= promotion.minQuantity) {
    return null
  }

  return `Requiere cantidad mínima de ${promotion.minQuantity} (llevás ${quantity}).`
}

/**
 * features/sales/components/PromotionsAvailableDialog.tsx
 * -----------------------------------------------------------------------------
 * Panel de solo lectura: lista TODAS las promociones ACTIVAS
 * (`GET /promotions?active=true`) — sin resumir a una, sin ocultar
 * ninguna, sin elegir cual mostrar — y marca con un badge "Aplicada" las
 * que el motor automatico YA decidio aplicar (`quoteData.appliedPromotions`).
 * Presentacion pura: no
 * llama a ningun endpoint nuevo, no calcula descuentos, no permite elegir
 * ni forzar ninguna promocion — esa capacidad no existe en
 * `CreateSaleQuoteDto`/`CreateSaleDto` (verificado: solo aceptan
 * `discountType`/`discountValue`/`items`), el motor de reglas
 * (stackable/exclusiveGroup/priority) es exclusivamente del backend.
 *
 * Bloque 3 ("separar completamente promociones de descuento manual"): el
 * punto de entrada ("Promociones", `SalesPOSPage.tsx`) ya NO depende de
 * cuantas promociones esten activas — existe siempre, igual que en un ERP.
 * Sin ninguna promocion activa, este componente muestra su propio estado
 * vacio (`EmptyState`, mismo componente compartido del resto del sistema)
 * en vez de una lista en blanco.
 *
 * Pulido visual final del POS (aprobado, "modal de Promociones — panel
 * profesional"): `max-w-lg` -> `max-w-xl` (un poco más ancho, ver pedido
 * explícito), encabezado con banda `bg-muted/40` (mismo criterio que
 * `RoleDrawer.tsx`) e ícono más grande, y cada fila pasa a
 * `PromotionCard.tsx` (compartida con `PromotionsActivationDialog.tsx`) —
 * mismo dato de siempre, presentación de card moderna en vez de fila
 * comprimida.
 */
export function PromotionsAvailableDialog({
  open,
  onOpenChange,
  promotions,
  appliedPromotionIds,
  cart,
}: PromotionsAvailableDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0 p-0">
        <div className="flex items-center gap-3.5 border-b bg-muted/40 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Tag className="size-5" />
          </span>
          <DialogHeader>
            <DialogTitle className="text-lg">Promociones disponibles</DialogTitle>
            <DialogDescription>
              Promociones activas para los productos de esta venta.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
          {promotions.length === 0 && (
            <EmptyState
              icon={Tag}
              title="No hay promociones disponibles"
              description="En este momento no hay promociones activas en el sistema."
            />
          )}

          {promotions.map((promotion) => {
            const isApplied = appliedPromotionIds.has(promotion.id)
            const EffectIcon = EFFECT_ICONS[promotion.effectType]
            const benefit = buildEffectSentence({
              scopeType: promotion.scopeType,
              effectType: promotion.effectType,
              effectValue: promotion.effectValue,
              buyQuantity: promotion.buyQuantity,
              payQuantity: promotion.payQuantity,
              selectedNames: resolveScopeNames(promotion),
            })
            const reason = isApplied ? null : unmetReason(promotion, cart)

            return (
              <PromotionCard
                key={promotion.id}
                name={promotion.name}
                icon={EffectIcon}
                effectLabel={EFFECT_TYPE_LABELS[promotion.effectType]}
                scopeLabel={SCOPE_TYPE_LABELS[promotion.scopeType]}
                benefit={benefit}
                highlighted={isApplied}
                statusSlot={
                  isApplied && (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-[0.625rem]">
                      <span className="size-1.5 shrink-0 rounded-full bg-current" />
                      Aplicada
                    </Badge>
                  )
                }
                footerNote={
                  !isApplied && (
                    <span className="text-xs font-medium text-accent-amber">
                      {reason ?? 'Disponible'}
                    </span>
                  )
                }
              />
            )
          })}
        </div>

        <DialogFooter className="border-t p-4 sm:justify-between">
          <p className="text-xs text-muted-foreground sm:max-w-72">
            El sistema aplica automáticamente la promoción que corresponda según
            sus reglas — no se puede elegir ni forzar una en particular.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
