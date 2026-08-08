import { create } from 'zustand'
import type { CashSession } from '../types/cashSession.types'

const CASH_SESSION_ID_KEY = 'cashSessionId'

function getStoredCashSessionId(): CashSession['id'] | null {
  return localStorage.getItem(CASH_SESSION_ID_KEY)
}

interface CashSessionState {
  /**
   * Id de la sesion de caja abierta por este cliente, guardado como
   * referencia local (o `null` si todavia no se abrio/detecto
   * ninguna). El resto de los datos de la sesion (sucursal, cajero,
   * monto de apertura, etc.) ya viven en la cache de React Query
   * (`useCashSessions`/`useOpenCashSession`) — no se duplican aqui,
   * solo el identificador necesario para correlacionar.
   *
   * Importante: este valor NO es la fuente de verdad para saber si una
   * caja registradora tiene una sesion `OPEN` — la sesion pertenece a
   * la caja registradora, no al usuario. Esa verificacion real se hace
   * contra el backend (`useCashSessions`, ver `OpenCashSessionForm.tsx`),
   * no contra este store. Este id es solo una referencia de
   * conveniencia de "cual fue la ultima sesion que abri este cliente".
   *
   * Usado por: OpenCashSessionForm (lo escribe al abrir con exito),
   * RequireCashSession (lo lee para decidir si deja pasar al POS) y
   * SalesPOSPage (lo lee para incluirlo en el payload de la venta).
   */
  cashSessionId: CashSession['id'] | null
  setCashSessionId: (id: CashSession['id']) => void
  clearCashSessionId: () => void
}

export const useCashSessionStore = create<CashSessionState>((set) => ({
  cashSessionId: getStoredCashSessionId(),

  setCashSessionId: (id) => {
    localStorage.setItem(CASH_SESSION_ID_KEY, id)

    set({ cashSessionId: id })
  },

  clearCashSessionId: () => {
    localStorage.removeItem(CASH_SESSION_ID_KEY)

    set({ cashSessionId: null })
  },
}))