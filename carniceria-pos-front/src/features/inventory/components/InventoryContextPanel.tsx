import { useNavigate } from 'react-router-dom'
import { ArrowRight, PackageMinus } from 'lucide-react'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity } from '@/utils/formatQuantity'
import { getDaysUntilExpiry } from '@/features/batches/utils/batch.utils'
import { BatchStatusBadge } from '@/features/batches/components/BatchStatusBadge'
import { WASTE_REASON_OPTIONS } from '../constants/wasteReason.constants'
import { useBatches } from '@/features/batches/hooks/useBatches'
import { useInventoryWastes } from '../hooks/useInventoryWastes'
import type { Inventory } from '../types/inventory.types'

interface InventoryContextPanelProps {
  item: Inventory
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

const UNIT_LABELS = { KILOGRAM: 'Kilogramos', UNIT: 'Unidades' } as const

/**
 * features/inventory/components/InventoryContextPanel.tsx
 * -----------------------------------------------------------------------------
 * Centro de Control de Inventario (aprobado): deja de ser una lista plana
 * de `ContextRow` (incluido "Stock reservado: No disponible", que ya vive
 * ahora como aviso propio del Hero en `InventoryAdjustDrawer.tsx`) y pasa
 * a ser el cuerpo de detalle que responde "¿qué está pasando con este
 * producto?" DEBAJO del Hero: "Lotes activos" y "Historial de mermas"
 * como mini-listas reales (no solo un conteo, mismo criterio ya aprobado
 * en `SupplierDrawer.tsx`: "Lotes de este proveedor"), más "Información
 * general". Mismos hooks ya existentes (`useBatches`/`useInventoryWastes`),
 * sin ningún cálculo nuevo — recibe el `item` completo (antes solo
 * `productId`/`unitOfMeasure`/`sucursalId`) porque ya tiene todo lo que
 * "Información general" necesita (SKU, sucursal, fechas), sin fetch extra.
 */
export function InventoryContextPanel({ item }: InventoryContextPanelProps) {
  const navigate = useNavigate()

  const { data: activeBatchesResponse, isLoading: isBatchesLoading } = useBatches({
    productId: item.productId,
    sucursalId: item.sucursalId,
    status: 'ACTIVE',
    limit: 5,
  })
  const activeBatches = activeBatchesResponse?.data ?? []

  const { data: wastesResponse, isLoading: isWastesLoading } = useInventoryWastes({
    productId: item.productId,
    sucursalId: item.sucursalId,
    limit: 5,
  })
  const recentWastes = [...(wastesResponse?.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Lotes activos</SectionTitle>
          <button
            type="button"
            onClick={() => navigate(`/inventory/batches?productId=${item.productId}`)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Ver todos <ArrowRight className="size-3" />
          </button>
        </div>
        {isBatchesLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : activeBatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin lotes activos para este producto.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activeBatches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-foreground">{batch.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatQuantity(batch.availableQuantity, item.product.unitOfMeasure)} disp.
                  </p>
                </div>
                <BatchStatusBadge status={batch.status} daysUntilExpiry={getDaysUntilExpiry(batch.expiryDate)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Historial de mermas</SectionTitle>
          <button
            type="button"
            onClick={() => navigate('/inventory/waste')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Ver todas <ArrowRight className="size-3" />
          </button>
        </div>
        {isWastesLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : recentWastes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin mermas registradas para este producto.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recentWastes.map((waste) => (
              <div
                key={waste.id}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                  <PackageMinus className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {WASTE_REASON_OPTIONS.find((option) => option.value === waste.reason)?.label ?? waste.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(waste.createdAt)}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-destructive">
                  -{formatQuantity(waste.quantity, item.product.unitOfMeasure)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Información general</SectionTitle>
        <div className="divide-y divide-border">
          <InfoRow label="SKU" value={item.product.sku ?? 'Sin SKU'} />
          <InfoRow label="Unidad de medida" value={UNIT_LABELS[item.product.unitOfMeasure]} />
          <InfoRow label="Sucursal" value={item.sucursal.name} />
          <InfoRow label="Última actualización" value={formatDateTime(item.updatedAt)} />
        </div>
      </div>
    </div>
  )
}
