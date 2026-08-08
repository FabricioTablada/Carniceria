import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import type { Permission } from '@/constants/permissions'

interface RequirePermissionProps {
  permission: Permission
  children: ReactNode
  redirectTo?: string
}

export function RequirePermission({
  permission,
  children,
  redirectTo = '/',
}: RequirePermissionProps) {
  const { hasPermission } = usePermissions()

  if (!hasPermission(permission)) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}
