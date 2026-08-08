import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'

interface CategoryStatusBadgeProps {
  active: boolean
}

export function CategoryStatusBadge({ active }: CategoryStatusBadgeProps) {
  return <ActiveStatusBadge active={active} />
}