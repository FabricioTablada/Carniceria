import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { getDefaultRoute } from '@/constants/navigation'

interface DashboardRouteProps {
  children: ReactNode
}

/**
 * Gate especifico de `/` (Dashboard): a diferencia de `RequirePermission`
 * (redirectTo fijo), aca el destino de redireccion es dinamico — el primer
 * modulo disponible segun los permisos del usuario (`getDefaultRoute`) —
 * para cubrir tanto la navegacion post-login como cualquier otra forma de
 * llegar a `/` (bookmark, boton atras, logo) sin permiso de Dashboard.
 */
export function DashboardRoute({ children }: DashboardRouteProps) {
  const { permissions } = usePermissions()
  const defaultRoute = getDefaultRoute(permissions)

  if (defaultRoute !== '/') {
    return <Navigate to={defaultRoute} replace />
  }

  return children
}
