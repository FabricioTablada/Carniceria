import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'

interface SupplierStatusBadgeProps {
  active: boolean
}

export function SupplierStatusBadge({ active }: SupplierStatusBadgeProps) {
  return <ActiveStatusBadge active={active} />
}