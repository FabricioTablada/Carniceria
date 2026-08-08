import { CalendarClock, CircleCheck, Lock, PackageX, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { BatchStatus } from '../types/batch.types'

/**
 * features/batches/components/BatchStatusBadge.tsx
 * -----------------------------------------------------------------------------
 * Mismo patron "pill" ya usado en `PurchaseStatusBadge.tsx`/`TaxStatusBadge.tsx`
 * sobre el `Badge` compartido (`components/common/Badge`, 4 variantes:
 * `secondary`/`muted`/`accent`/`destructive`).
 *
 * Centro de Control de Inventario (aprobado): cada estado suma un ícono
 * (no solo color+texto) y "Por vencer" (`daysUntilExpiry` opcional, mismo
 * umbral de `countExpiringSoon`/`getDaysUntilExpiry` ya usado en
 * `BatchesKpiRow.tsx`) deja de mostrarse como "Activo" liso — protagonismo
 * visual propio (`warning`, reloj), sin tocar el estado real del lote.
 * Prop aditiva: sin ella, comportamiento idéntico al de antes (`BatchDrawer.tsx`
 * no la pasa y no cambia).
 */
const EXPIRING_SOON_THRESHOLD_DAYS = 7

const STATUS_LABELS: Record<BatchStatus, string> = {
  ACTIVE: 'Activo',
  DEPLETED: 'Agotado',
  EXPIRED: 'Vencido',
  BLOCKED: 'Bloqueado',
}

const STATUS_VARIANTS: Record<BatchStatus, BadgeVariant> = {
  ACTIVE: 'accent',
  DEPLETED: 'muted',
  EXPIRED: 'destructive',
  BLOCKED: 'destructive',
}

const STATUS_ICONS: Record<BatchStatus, LucideIcon> = {
  ACTIVE: CircleCheck,
  DEPLETED: PackageX,
  EXPIRED: TriangleAlert,
  BLOCKED: Lock,
}

interface BatchStatusBadgeProps {
  status: BatchStatus
  className?: string
  /** Días hasta el vencimiento (`getDaysUntilExpiry`) — cuando se pasa y
   * el lote sigue `ACTIVE` dentro del umbral, se muestra "Por vencer" en
   * vez de "Activo". Opcional/aditivo. */
  daysUntilExpiry?: number | null
}

export function BatchStatusBadge({ status, className, daysUntilExpiry }: BatchStatusBadgeProps) {
  const isExpiringSoon =
    status === 'ACTIVE' &&
    daysUntilExpiry !== null &&
    daysUntilExpiry !== undefined &&
    daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS

  const variant: BadgeVariant = isExpiringSoon ? 'destructive' : STATUS_VARIANTS[status]
  const Icon = isExpiringSoon ? CalendarClock : STATUS_ICONS[status]
  const label = isExpiringSoon ? 'Por vencer' : STATUS_LABELS[status]

  return (
    <Badge variant={variant} className={className}>
      <Icon className="size-3 shrink-0" />
      {label}
    </Badge>
  )
}
