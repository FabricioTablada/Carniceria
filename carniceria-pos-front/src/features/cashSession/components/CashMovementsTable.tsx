import type { ReactNode } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Coins, type LucideIcon, Undo2 } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import type { CashMovement, CashMovementType } from '../types/cashSession.types'

interface CashMovementsTableProps {
  movements: CashMovement[]
  emptyMessage?: ReactNode
}

// QA.5 (Caja): faltaba `REFUND` (reembolso en efectivo de una devolución,
// Bloque 4.1) — un movimiento real que esta tabla ya podía recibir, pero
// mostraba con una etiqueta vacía y el badge genérico de "Egreso" (mismo
// color, sin forma de distinguirlo).
//
// Version 1.0.3, Bloque 3: `Record<CashMovementType, ...>` en vez de la
// cadena de ternarios anterior — a propósito, para que agregar un nuevo
// valor al enum sin actualizar esta tabla sea un error de compilación
// (`tsc`), no un badge en blanco descubierto en producción (causa raíz real
// de este mismo bloque, con `CHANGE`). `CHANGE` usa `accent` (ni el verde de
// ingreso ni el rojo de egreso) — es un dato de trazabilidad, no clasifica
// como entrada/salida de caja para el usuario (mismo criterio que ya aplica
// `cashSessionInsights.ts`, sin tocarlo).
const MOVEMENT_TYPE_CONFIG: Record<CashMovementType, { label: string; badgeVariant: BadgeVariant; icon: LucideIcon }> = {
  CASH_IN: { label: 'Ingreso', badgeVariant: 'secondary', icon: ArrowDownCircle },
  CASH_OUT: { label: 'Egreso', badgeVariant: 'destructive', icon: ArrowUpCircle },
  REFUND: { label: 'Reembolso', badgeVariant: 'destructive', icon: Undo2 },
  CHANGE: { label: 'Vuelto', badgeVariant: 'accent', icon: Coins },
}

/**
 * features/cashSession/components/CashMovementsTable.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Caja — pestaña "Movimientos": tabla de solo lectura sobre
 * `useCashMovements` (primer consumo de `GET /cash/movements`). "Estado"
 * muestra siempre "Registrado": `CashMovement` es un asiento inmutable de
 * una sola vez (sin campo de estado en el modelo, no hay forma de
 * anular/corregir un movimiento) — mismo criterio de "valor honesto, no
 * inventado" ya aplicado a "Cliente: Público General" en Ventas.
 */
export function CashMovementsTable({
  movements,
  emptyMessage = 'No hay movimientos registrados en esta sesión.',
}: CashMovementsTableProps) {
  const columns: DataTableColumn<CashMovement>[] = [
    {
      header: 'Tipo',
      render: (movement) => {
        const { label, badgeVariant, icon: Icon } = MOVEMENT_TYPE_CONFIG[movement.type]
        return (
          <Badge variant={badgeVariant} className="gap-1.5">
            <Icon className="size-3.5" />
            {label}
          </Badge>
        )
      },
    },
    {
      header: 'Responsable',
      render: (movement) => movement.user.fullName,
      className: 'text-muted-foreground',
    },
    {
      header: 'Hora',
      render: (movement) => formatDateTime(movement.createdAt),
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
    },
    {
      header: 'Motivo',
      render: (movement) => (
        <span className="block max-w-[20rem] truncate" title={movement.reason}>
          {movement.reason}
        </span>
      ),
    },
    {
      header: 'Monto',
      render: (movement) => formatCurrency(movement.amount),
      className: 'text-right font-semibold tabular-nums',
      headerClassName: 'text-right',
    },
    {
      header: 'Estado',
      render: () => <Badge variant="muted">Registrado</Badge>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={movements}
      getRowKey={(movement) => movement.id}
      emptyMessage={emptyMessage}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
      cellClassName="px-4 py-3"
    />
  )
}
