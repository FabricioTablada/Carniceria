import { useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackageCheck, Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaxes } from '@/features/taxes/hooks/useTaxes'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { useProducts } from '@/features/products/hooks/useProducts'
import { createPurchaseSchema } from '../schemas/purchase.schema'
import { usePurchasesWindow } from '../hooks/usePurchasesWindow'
import { duplicatePurchaseToDto } from '../utils/duplicatePurchase'
import { PurchaseHeaderFields } from './PurchaseHeaderFields'
import { PurchaseItemsWorkspace } from './PurchaseItemsWorkspace'
import { PurchaseSummary } from './PurchaseSummary'
import { PurchaseSupplierContextPanel } from './PurchaseSupplierContextPanel'
import { PurchaseConfirmDialog, type PurchaseConfirmItem } from './PurchaseConfirmDialog'
import type { CreatePurchaseDto, Purchase } from '../types/purchase.types'

interface PurchaseFormProps {
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario — solo
   * despues de que el usuario confirma en `PurchaseConfirmDialog`, nunca
   * directamente al presionar un boton de guardado. */
  onSubmit: (values: CreatePurchaseDto) => void
  /** Rediseño de Proveedores (aprobado): "Nueva compra a este proveedor"
   * (`SupplierDrawer.tsx`) navega con `location.state.supplierId` — mismo
   * mecanismo ya construido para Categorías/Impuestos. Fija el valor
   * INICIAL del campo `supplierId`; el `<Select>` de
   * `PurchaseHeaderFields.tsx` sigue siendo completamente editable. */
  initialSupplierId?: string
}

const DEFAULT_VALUES: CreatePurchaseDto = {
  supplierId: '',
  documentNumber: null,
  status: undefined,
  purchaseDate: undefined,
  notes: null,
  items: [],
}

/**
 * features/purchases/components/PurchaseForm.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras ("documento vivo"): reemplaza el único botón
 * "Guardar compra" por dos acciones explícitas — "Guardar como borrador" y
 * "Guardar y recibir ahora" — que fijan `status` antes de abrir el mismo
 * `PurchaseConfirmDialog` de siempre (ahora con una vista previa adicional
 * de consecuencias cuando el destino es "recibir"). El backend no cambia:
 * ambas acciones terminan en el mismo `POST /purchases`, con
 * `status: undefined` (el backend asume `DRAFT`) o `status: 'RECEIVED'`.
 *
 * "Duplicar compra anterior" (`PurchaseItemsWorkspace.tsx`) usa `reset()`
 * de este mismo formulario para precargar proveedor/notas/líneas a partir
 * de una compra ya existente (`duplicatePurchaseToDto`) — no dispara
 * ninguna consulta nueva, la compra elegida ya viene cargada por
 * `DuplicatePurchaseDialog.tsx`.
 *
 * Canvas Workspace (aprobado): el panel lateral fijo (`lg:sticky lg:w-80`)
 * se elimina — `PurchaseHeaderFields` (banda de identidad) +
 * `PurchaseItemsWorkspace` + `PurchaseSummary` + `PurchaseSupplierContextPanel`
 * + el aviso + las acciones de guardado pasan a vivir apilados dentro de
 * UNA sola superficie (`rounded-2xl border bg-card shadow-sm`), en el
 * mismo orden y con exactamente los mismos datos/props de siempre — solo
 * cambia la composición visual (columna única en vez de 2 columnas),
 * nunca el flujo ("Guardar como borrador"/"Guardar y recibir ahora"
 * siguen abriendo el mismo `PurchaseConfirmDialog` antes de enviar).
 */
export function PurchaseForm({
  isSubmitting = false,
  onSubmit,
  initialSupplierId,
}: PurchaseFormProps) {
  const {
    register,
    control,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePurchaseDto>({
    resolver: zodResolver(createPurchaseSchema as never) as unknown as Resolver<CreatePurchaseDto>,
    defaultValues: initialSupplierId
      ? { ...DEFAULT_VALUES, supplierId: initialSupplierId }
      : DEFAULT_VALUES,
  })

  const { data: taxesResponse } = useTaxes({ active: true })
  const taxes = taxesResponse?.data ?? []

  const { data: suppliersResponse } = useSuppliers({ active: true })
  const suppliers = suppliersResponse?.data ?? []

  // `limit: 100` (techo real del backend): sin esto, el default de 20
  // dejaba sin resolver el nombre de cualquier producto mas alla de la
  // primera pagina (`products.find(...)`, mas abajo).
  const { data: productsResponse } = useProducts({ active: true, limit: 100 })
  const products = productsResponse?.data ?? []

  // Rediseño de Compras: misma ventana de compras recientes que ya usa
  // `useProductLastPurchase.ts` en cada tarjeta — se reutiliza aca
  // (cacheada por TanStack Query, sin fetch adicional) para el indicador
  // agregado "costo distinto a la última compra" del panel lateral.
  const { data: recentPurchases } = usePurchasesWindow()

  const items = useWatch({ control, name: 'items' }) ?? []
  const supplierId = useWatch({ control, name: 'supplierId' })
  const status = useWatch({ control, name: 'status' })

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0),
    0,
  )
  const taxTotal = items.reduce((sum, item) => {
    const lineBase = (Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0)
    const tax = item?.taxId ? taxes.find((candidate) => candidate.id === item.taxId) : undefined
    return sum + (tax ? lineBase * (tax.rate / 100) : 0)
  }, 0)
  const total = subtotal + taxTotal

  const distinctTaxIds = new Set(
    items.filter((item) => item?.productId).map((item) => item?.taxId ?? null),
  )
  const singleTax =
    distinctTaxIds.size === 1 && !distinctTaxIds.has(null)
      ? taxes.find((tax) => tax.id === [...distinctTaxIds][0])
      : undefined
  const summaryTaxLabel = singleTax ? `${singleTax.name} ${singleTax.rate}%` : undefined

  // Panel lateral inteligente: cuantas lineas ya cargadas corresponden a un
  // producto con `requiresBatch` (cruce contra `products`, ya fetcheado
  // arriba, sin consulta nueva) y cuantas tienen un costo distinto al de la
  // ultima compra conocida de ese producto (cruce contra `recentPurchases`,
  // misma ventana que ya usa cada tarjeta).
  const itemsWithProduct = items.filter((item) => item?.productId)
  const batchCount = itemsWithProduct.filter(
    (item) => products.find((product) => product.id === item?.productId)?.requiresBatch,
  ).length
  const costWarningCount = itemsWithProduct.filter((item) => {
    const matches = (recentPurchases ?? [])
      .flatMap((purchase) => purchase.items.map((purchaseItem) => ({ ...purchaseItem, purchaseDate: purchase.purchaseDate })))
      .filter((purchaseItem) => purchaseItem.productId === item?.productId)
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())

    const lastKnownCost = matches[0]?.unitCost
    return lastKnownCost !== undefined && Number(item?.unitCost) !== lastKnownCost
  }).length

  const [pendingValues, setPendingValues] = useState<CreatePurchaseDto | null>(null)

  const submitWithStatus = (targetStatus: CreatePurchaseDto['status']) =>
    handleSubmit((values) => setPendingValues({ ...values, status: targetStatus }))()

  const handleConfirmPurchase = () => {
    if (!pendingValues) {
      return
    }

    onSubmit(pendingValues)
    setPendingValues(null)
  }

  const handleDuplicatePurchase = (purchase: Purchase) => {
    reset({ ...DEFAULT_VALUES, ...duplicatePurchaseToDto(purchase) })
  }

  const confirmItems: PurchaseConfirmItem[] =
    pendingValues?.items.map((item) => {
      const tax = item.taxId ? taxes.find((candidate) => candidate.id === item.taxId) : undefined
      const rate = tax?.rate ?? 0

      return {
        productName: products.find((product) => product.id === item.productId)?.name ?? item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        taxLabel: tax ? `${tax.name} (${rate}%)` : 'Sin impuesto',
        lineTotal: item.quantity * item.unitCost * (1 + rate / 100),
      }
    }) ?? []

  const receiveConsequences =
    pendingValues?.status === 'RECEIVED'
      ? {
          productCount: new Set(pendingValues.items.map((item) => item.productId)).size,
          batchCount: pendingValues.items.filter(
            (item) => products.find((product) => product.id === item.productId)?.requiresBatch,
          ).length,
        }
      : undefined

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        <PurchaseHeaderFields
          control={control}
          register={register}
          errors={errors}
          isSubmitting={isSubmitting}
        />

        <div className="flex flex-col gap-5 p-5">
          <PurchaseItemsWorkspace
            control={control}
            setValue={setValue}
            errors={errors}
            isSubmitting={isSubmitting}
            onDuplicatePurchase={handleDuplicatePurchase}
            autoOpenAddProduct={Boolean(initialSupplierId)}
          />

          <PurchaseSummary
            subtotal={subtotal}
            taxTotal={taxTotal}
            total={total}
            taxLabel={summaryTaxLabel}
            supplierName={suppliers.find((supplier) => supplier.id === supplierId)?.name}
            status={status}
            lineCount={itemsWithProduct.length}
            batchCount={batchCount}
            costWarningCount={costWarningCount}
          />

          {supplierId && <PurchaseSupplierContextPanel supplierId={supplierId} />}

          <div className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/10 p-4 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">Revisa la información antes de guardar</span>
              <span className="text-muted-foreground">
                Podrás confirmar todos los detalles antes de registrar la compra.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-b-2xl border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="xl"
            disabled={isSubmitting}
            onClick={() => submitWithStatus(undefined)}
            className="gap-2"
          >
            <Save className="size-4" />
            Guardar como borrador
          </Button>
          <Button
            type="button"
            size="xl"
            disabled={isSubmitting}
            onClick={() => submitWithStatus('RECEIVED')}
            className="gap-2 bg-brand text-brand-foreground shadow-md hover:bg-brand-hover active:bg-brand-active"
          >
            <PackageCheck className="size-4" />
            {isSubmitting ? 'Guardando...' : 'Guardar y recibir ahora'}
          </Button>
        </div>
      </div>

      <PurchaseConfirmDialog
        open={pendingValues !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingValues(null)
          }
        }}
        supplierName={
          suppliers.find((supplier) => supplier.id === pendingValues?.supplierId)?.name ?? '—'
        }
        documentNumber={pendingValues?.documentNumber}
        purchaseDate={pendingValues?.purchaseDate}
        items={confirmItems}
        subtotal={subtotal}
        taxTotal={taxTotal}
        total={total}
        onConfirm={handleConfirmPurchase}
        isSubmitting={isSubmitting}
        receiveConsequences={receiveConsequences}
      />
    </form>
  )
}
