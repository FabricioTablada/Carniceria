import { useAuthStore } from '@/stores/authStore'
import type { Permission } from '@/constants/permissions'

export function usePermissions() {
  const user = useAuthStore((state) => state.user)

  const permissions: Permission[] = user?.permissions ?? []

  const hasPermission = (permission: Permission) => {
    return permissions.includes(permission)
  }

  const hasAnyPermission = (required: Permission[]) => {
    return required.some((permission) =>
      permissions.includes(permission),
    )
  }

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
  }
}