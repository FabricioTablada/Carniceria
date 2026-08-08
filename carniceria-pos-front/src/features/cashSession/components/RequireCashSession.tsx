import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCashSessionStore } from '../store/cashSessionStore'
import { useCashSessions } from '../hooks/useCashSessions'

interface RequireCashSessionProps {
  children: ReactNode
}

/**
 * Guard de ruta para el POS (`/sales/pos`). La sesion pertenece a la caja
 * registradora, no al usuario, por lo que el acceso se decide consultando
 * `useCashSessions({ status: 'OPEN' })` (backend) — no leyendo
 * `cashSessionStore`/`localStorage` como fuente de verdad. El store se
 * usa unicamente para resincronizar el id ya confirmado (setCashSessionId)
 * o para limpiarlo (clearCashSessionId) segun corresponda, en beneficio de
 * otros consumidores (`SalesPOSPage`) que todavia lo leen de ahi.
 */
export function RequireCashSession({
  children,
}: RequireCashSessionProps) {
  const setCashSessionId = useCashSessionStore((state) => state.setCashSessionId)
  const clearCashSessionId = useCashSessionStore(
    (state) => state.clearCashSessionId,
  )

  const { data: openSessionsResponse, isLoading } = useCashSessions({
    status: 'OPEN',
  })
  const openCashSession = openSessionsResponse?.data[0] ?? null

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (openCashSession) {
      setCashSessionId(openCashSession.id)
    } else {
      clearCashSessionId()
    }
  }, [isLoading, openCashSession, setCashSessionId, clearCashSessionId])

  if (isLoading) {
    return null
  }

  if (!openCashSession) {
    return <Navigate to="/cash-session/open" replace />
  }

  return children
}