import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'

interface CustomerStatusBadgeProps {
  active: boolean
}

export function CustomerStatusBadge({ active }: CustomerStatusBadgeProps) {
  return <ActiveStatusBadge active={active} />
}
