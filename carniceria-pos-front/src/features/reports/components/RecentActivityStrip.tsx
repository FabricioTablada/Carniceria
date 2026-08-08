import { Link } from 'react-router-dom'
import { AlertTriangle, ShoppingCart, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { useSales } from '@/features/sales/hooks/useSales'
import { usePurchases } from '@/features/purchases/hooks/usePurchases'
import { useInventoryWastes } from '@/features/inventory/hooks/useInventoryWastes'
import { useCashReport } from '../hooks/useCashReport'

interface ActivityCellData {
  icon: LucideIcon
  label: string
  title: string
  detail: string
  timestamp: string
  href: string
}

function ActivityCellSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-4">
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

function ActivityCell({ data }: { data: ActivityCellData | null }) {
  if (!data) {
    return (
      <div className="flex flex-col gap-1.5 p-4">
        <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
          Sin actividad
        </span>
        <span className="text-sm text-muted-foreground">Todavía no hay registros.</span>
      </div>
    )
  }

  return (
    <Link
      to={data.href}
      className="flex flex-col gap-1.5 p-4 transition-colors duration-150 hover:bg-brand/5"
    >
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        <data.icon className="size-3.5 text-brand" />
        {data.label}
      </span>
      <span className="truncate text-sm font-semibold text-foreground">{data.title}</span>
      <span className="truncate text-xs text-muted-foreground">
        {data.detail} · {formatRelativeTime(data.timestamp)}
      </span>
    </Link>
  )
}

/**
 * features/reports/components/RecentActivityStrip.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado, "franja de Actividad reciente... sin
 * crear endpoints ni cálculos nuevos"): última venta, última compra
 * recibida, última sesión de caja cerrada y última merma registrada —
 * los 4 datos pedidos explícitamente, cada uno resuelto con un hook YA
 * EXISTENTE de su propio módulo (`useSales`/`usePurchases`/
 * `useCashReport`/`useInventoryWastes`), pidiendo un puñado de registros
 * (`limit: 5`) y quedándose con el más reciente tras un `sort` en el
 * cliente — mismo patrón exacto que `DashboardPage.tsx::recentSales` ya
 * usa para lo mismo. Ningún endpoint nuevo, ningún agregado en el
 * backend: es la misma técnica de "tomar el primero de una lista ya
 * pedida", aplicada 4 veces.
 */
export function RecentActivityStrip() {
  const { data: salesResponse, isLoading: isSalesLoading } = useSales({ limit: 5 })
  const { data: purchasesResponse, isLoading: isPurchasesLoading } = usePurchases({
    status: 'RECEIVED',
    limit: 5,
  })
  const { data: cashResponse, isLoading: isCashLoading } = useCashReport({ status: 'CLOSED', limit: 5 })
  const { data: wastesResponse, isLoading: isWastesLoading } = useInventoryWastes({ limit: 5 })

  const lastSale = [...(salesResponse?.data ?? [])].sort(
    (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime(),
  )[0]
  const lastPurchase = [...(purchasesResponse?.data ?? [])].sort(
    (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime(),
  )[0]
  const lastCashSession = [...(cashResponse?.data ?? [])].sort(
    (a, b) => new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime(),
  )[0]
  const lastWaste = [...(wastesResponse?.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0]

  const isLoading = isSalesLoading || isPurchasesLoading || isCashLoading || isWastesLoading

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Actividad reciente
        </span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {isLoading ? (
          <>
            <ActivityCellSkeleton label="Última venta" />
            <ActivityCellSkeleton label="Última compra recibida" />
            <ActivityCellSkeleton label="Última sesión de caja cerrada" />
            <ActivityCellSkeleton label="Última merma registrada" />
          </>
        ) : (
          <>
            <ActivityCell
              data={
                lastSale
                  ? {
                      icon: ShoppingCart,
                      label: 'Última venta',
                      title: lastSale.documentNumber ?? formatCurrency(lastSale.total),
                      detail: `${lastSale.user.fullName} · ${formatCurrency(lastSale.total)}`,
                      timestamp: lastSale.saleDate,
                      href: '/reports/sales',
                    }
                  : null
              }
            />
            <ActivityCell
              data={
                lastPurchase
                  ? {
                      icon: Truck,
                      label: 'Última compra recibida',
                      title: lastPurchase.documentNumber ?? formatCurrency(lastPurchase.total),
                      detail: `${lastPurchase.supplier.name} · ${formatCurrency(lastPurchase.total)}`,
                      timestamp: lastPurchase.purchaseDate,
                      href: '/reports/purchases',
                    }
                  : null
              }
            />
            <ActivityCell
              data={
                lastCashSession?.closedAt
                  ? {
                      icon: Wallet,
                      label: 'Última sesión de caja cerrada',
                      title: lastCashSession.cashRegister.name,
                      detail: formatCurrency(lastCashSession.salesTotal),
                      timestamp: lastCashSession.closedAt,
                      href: '/reports/cash',
                    }
                  : null
              }
            />
            <ActivityCell
              data={
                lastWaste
                  ? {
                      icon: AlertTriangle,
                      label: 'Última merma registrada',
                      title: lastWaste.product.name,
                      detail: formatCurrency(lastWaste.totalValue),
                      timestamp: lastWaste.createdAt,
                      href: '/inventory/waste',
                    }
                  : null
              }
            />
          </>
        )}
      </div>
    </div>
  )
}
