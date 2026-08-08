import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { PurchaseStatus } from '../types/purchase.types'

/**
 * features/purchases/components/PurchaseStatusBadge.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — Compras. Centraliza `STATUS_LABELS`/
 * `STATUS_VARIANTS`, antes duplicados idénticos en `PurchasesTable.tsx` y
 * `PurchaseDetailPage.tsx` (hallazgo del análisis UX). Mismo patrón "pill"
 * ya usado en otros badges de estado del ERP, sobre el `Badge` compartido
 * (`components/common/Badge`, única variante con `destructive`).
 */
const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: 'Borrador',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
}

const STATUS_VARIANTS: Record<PurchaseStatus, BadgeVariant> = {
  DRAFT: 'muted',
  RECEIVED: 'secondary',
  CANCELLED: 'destructive',
}

interface PurchaseStatusBadgeProps {
  status: PurchaseStatus
  className?: string
}

export function PurchaseStatusBadge({ status, className }: PurchaseStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Badge>
  )
}
