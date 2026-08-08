import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

/**
 * routes/RequireRole.tsx
 * -----------------------------------------------------------------------------
 * QA Final 1.0 (Bloque 5): mismo patrón exacto que `RequirePermission.tsx`,
 * para el único caso del ERP donde el backend restringe una ruta por ROL
 * literal en vez de por código de permiso (`PATCH /purchases/:id` usa
 * `authorize(SystemRole.ADMIN)`, no `authorizePermission(...)` —
 * `purchases.routes.ts`, backend). Mismo criterio ya usado en el frontend
 * para comparar contra `'ADMIN'` (`PurchaseDetailPage.tsx`,
 * `CashSessionAuditSection.tsx`) — no se inventa un permiso nuevo que el
 * backend no tiene.
 */
interface RequireRoleProps {
  role: string
  children: ReactNode
  redirectTo?: string
}

export function RequireRole({ role, children, redirectTo = '/' }: RequireRoleProps) {
  const user = useAuthStore((state) => state.user)

  if (user?.role !== role) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}
