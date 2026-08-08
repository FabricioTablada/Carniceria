import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'

interface TaxStatusBadgeProps {
  active: boolean
}

export function TaxStatusBadge({ active }: TaxStatusBadgeProps) {
  return <ActiveStatusBadge active={active} />
}