import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'

interface UserStatusBadgeProps {
  active: boolean
}

export function UserStatusBadge({ active }: UserStatusBadgeProps) {
  return <ActiveStatusBadge active={active} />
}