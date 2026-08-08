import { Truck } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/common/Badge'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatPurchaseDate } from '../utils/purchase.utils'
import { useSupplierPurchaseStats } from '../hooks/useSupplierPurchaseStats'

interface PurchaseSupplierContextPanelProps {
  supplierId: string
}

/**
 * features/purchases/components/PurchaseSupplierContextPanel.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — "contexto del proveedor": aparece en el panel
 * lateral en cuanto se elige un proveedor, sin salir del módulo. Datos de
 * `useSupplierPurchaseStats.ts` (`GET /purchases?supplierId=X`, filtro que
 * ya existe en el backend). Deliberadamente sin "tiempo promedio de
 * entrega" — ver ese hook para la justificación (el backend no tiene un
 * par de fechas orden/recepción del que derivarlo).
 */
export function PurchaseSupplierContextPanel({ supplierId }: PurchaseSupplierContextPanelProps) {
  const { data: stats, isLoading } = useSupplierPurchaseStats(supplierId)

  if (isLoading || !stats) {
    return null
  }

  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="size-4 text-brand" />
          Este proveedor
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5 px-4 pt-0 pb-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Compras registradas</span>
          <span className="font-medium tabular-nums">{stats.totalPurchases}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Última compra</span>
          <span className="font-medium">
            {stats.lastPurchaseDate ? formatPurchaseDate(stats.lastPurchaseDate) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Monto promedio</span>
          <span className="font-medium tabular-nums">{formatCurrency(stats.averageAmount)}</span>
        </div>

        {stats.recentProducts.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-2.5">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Productos recientes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {stats.recentProducts.map((productName) => (
                <Badge key={productName} variant="muted">
                  {productName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
