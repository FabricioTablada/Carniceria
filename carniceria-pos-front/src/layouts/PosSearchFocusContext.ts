import { createContext, useContext, type RefObject } from 'react'

/**
 * layouts/PosSearchFocusContext.ts
 * -----------------------------------------------------------------------------
 * Comparte el ref del input de busqueda del POS entre `PosLayout.tsx`
 * (dueno del dialogo "Movimiento de caja") y `SalesPOSPage.tsx` (dueno del
 * buscador en si) sin duplicar el ref ni la logica de foco en ninguno de
 * los dos: ambos leen/escriben el mismo `RefObject`, creado una unica vez
 * en `PosLayout.tsx`.
 */
export const PosSearchFocusContext = createContext<RefObject<HTMLInputElement | null> | null>(
  null,
)

export function usePosSearchFocusRef() {
  return useContext(PosSearchFocusContext)
}
