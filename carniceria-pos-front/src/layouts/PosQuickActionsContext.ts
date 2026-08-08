import { createContext, useContext, type RefObject } from 'react'

/** Acciones del carrito/venta en curso que `SalesPOSPage.tsx` ya
 * implementaba (o cuyos setters ya existian) y que ahora tambien dispara
 * `PosSidebar.tsx` — ningun handler es nuevo, solo un segundo punto de
 * entrada visual a la misma logica. */
export interface PosQuickActions {
  /** Vacia el carrito y reinicia descuento/referencia de pago — mismos
   * setters que ya se llamaban al completar una venta (`onSuccess` de
   * `handleConfirmSale`), ahora tambien disponibles como accion manual
   * ("Nueva venta"/"Vaciar carrito"). */
  onNewSale: () => void
  /** Abre `CartDiscountDialog.tsx` (descuento manual) — Bloque 3: dejo de
   * depender de cuantas promociones esten activas (esas tienen su propio
   * punto de entrada independiente, "Promociones", ver
   * `PromotionsAvailableDialog.tsx`). Nunca cambia `discountType` (eso
   * sigue siendo exclusivo de `CartDiscount.tsx` via
   * `onDiscountTypeChange`; una version anterior lo forzaba a
   * "PERCENTAGE" y pisaba la eleccion del cajero, ver QA). */
  onFocusDiscount: () => void
  /** Abre `SessionSalesDialog.tsx` — mismo estado que ya controla el
   * boton "Ventas de la sesión" del header (unico camino existente hacia
   * anular/corregir/devolver una venta). */
  onOpenSessionSales: () => void
  /** Bloque POS-05: abre `PromotionsActivationDialog.tsx` — catalogo
   * completo de promociones (activas e inactivas) con capacidad de
   * activar/desactivar. Distinto de "Promociones" del panel del carrito
   * (`handleOpenPromotions`/`PromotionsAvailableDialog.tsx`, de solo
   * lectura, solo activas) — ambos conviven, ninguno reemplaza al otro. */
  onOpenPromotionsCatalog: () => void
}

/**
 * layouts/PosQuickActionsContext.ts
 * -----------------------------------------------------------------------------
 * Mismo patron que `PosSearchFocusContext.ts`: comparte, via un
 * `RefObject` mutable creado una unica vez en `PosLayout.tsx`, un objeto de
 * callbacks entre `SalesPOSPage.tsx` (dueno del carrito/descuento/dialogo
 * de ventas de la sesion) y `PosSidebar.tsx` (que vive en `PosLayout.tsx`,
 * fuera del arbol de `SalesPOSPage.tsx`) — sin mover ningun estado, sin
 * duplicar logica, sin ningun endpoint/regla nueva.
 */
export const PosQuickActionsContext = createContext<RefObject<PosQuickActions | null> | null>(
  null,
)

export function usePosQuickActionsRef() {
  return useContext(PosQuickActionsContext)
}
