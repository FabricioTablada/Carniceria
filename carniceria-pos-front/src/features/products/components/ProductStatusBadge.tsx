import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'

interface ProductStatusBadgeProps {
  active: boolean
}

export function ProductStatusBadge({ active }: ProductStatusBadgeProps) {
  return <ActiveStatusBadge active={active} />
}