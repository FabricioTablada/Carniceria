import { Badge } from '@/components/common/Badge'

interface UserRoleBadgeProps {
  role: {
    name: string
  }
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  return <Badge variant="accent">{role.name}</Badge>
}