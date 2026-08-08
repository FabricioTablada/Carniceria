import type { ReactNode } from 'react'
import type { Permission } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'

interface CanProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function Can({
  permission,
  children,
  fallback = null,
}: CanProps) {
  const { hasPermission } = usePermissions()

  if (!hasPermission(permission)) {
    return fallback
  }

  return children
}