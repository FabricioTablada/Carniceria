import { Navigate, useParams } from 'react-router-dom'

/**
 * features/cashSession/pages/CashSessionRedirect.tsx
 * -----------------------------------------------------------------------------
 * Wireframe aprobado "Caja — Centro de Control": Caja pasa a ser la única
 * fuente de verdad para sesiones de caja — `CashReportPage.tsx`/
 * `CashSessionDetailPage.tsx` (Reportes) se retiran como pantallas propias.
 * `/reports/cash/:id` sigue registrada (mismo path, sin tocar rutas) para
 * no romper los links ya existentes (`CashSessionSummaryPanel.tsx` del
 * POS, notificaciones), pero ahora redirige a `/cash-session/open`,
 * pasando el id como query param para que `CashSessionsPage.tsx` abra el
 * Drawer de esa sesión automáticamente.
 */
export function CashSessionRedirect() {
  const { id } = useParams<{ id: string }>()

  return <Navigate to={id ? `/cash-session/open?session=${id}` : '/cash-session/open'} replace />
}
