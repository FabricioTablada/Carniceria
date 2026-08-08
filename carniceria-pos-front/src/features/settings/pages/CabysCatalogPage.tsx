import { useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import {
  useApplyCabysCatalogUpdate,
  useCheckForCabysCatalogUpdates,
  usePreviewCabysCatalogUpdate,
} from '../hooks/useCabysCatalogSync'
import { getSettingsErrorMessage } from '../utils/settingsErrors'
import type {
  ApplyCabysCatalogUpdateResult,
  PreviewCabysCatalogUpdateResult,
} from '../types/cabysCatalog.types'

/**
 * features/settings/pages/CabysCatalogPage.tsx
 * -----------------------------------------------------------------------------
 * Configuración → Catálogo CABYS (bloque "Actualización inteligente del
 * catálogo CABYS"). Flujo aprobado, sin ningún paso automático:
 *
 *   "Buscar actualizaciones" -> verificación liviana (nunca descarga el
 *   archivo completo) -> si no hay novedad, un único mensaje, fin -> si hay
 *   novedad, "Descargar y comparar" (descarga a un temporal, valida,
 *   compara — nunca escribe) -> resumen + diálogo de confirmación -> recién
 *   ahí "Actualizar" aplica el diff ya mostrado -> reporte de productos a
 *   revisar (informativo, nunca modifica ningún producto).
 *
 * Cada paso es un botón explícito distinto — no hay ningún `useEffect` que
 * encadene un paso con el siguiente solo.
 */
export function CabysCatalogPage() {
  const [upToDateChecked, setUpToDateChecked] = useState(false)
  const [preview, setPreview] = useState<PreviewCabysCatalogUpdateResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyCabysCatalogUpdateResult | null>(null)

  const checkForUpdates = useCheckForCabysCatalogUpdates()
  const previewUpdate = usePreviewCabysCatalogUpdate()
  const applyUpdate = useApplyCabysCatalogUpdate()

  const handleCheckForUpdates = () => {
    setUpToDateChecked(false)
    setPreview(null)
    setApplyResult(null)
    checkForUpdates.mutate(undefined, {
      onSuccess: (result) => {
        setUpToDateChecked(!result.hasUpdate)
      },
    })
  }

  const handleDownloadAndCompare = () => {
    previewUpdate.mutate(undefined, {
      onSuccess: (result) => {
        setPreview(result)
        setConfirmOpen(true)
      },
    })
  }

  const handleConfirmUpdate = () => {
    if (!preview) return

    applyUpdate.mutate(preview.previewToken, {
      onSuccess: (result) => {
        setApplyResult(result)
        setConfirmOpen(false)
        setPreview(null)
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Catálogo CABYS"
        description="Verificá y aplicá actualizaciones del catálogo oficial de códigos CABYS (Banco Central de Costa Rica)."
        breadcrumb={[{ label: 'Configuración', href: '/settings' }, { label: 'Catálogo CABYS' }]}
      />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Catálogo oficial CABYS</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compara la versión publicada por el BCCR contra el catálogo cargado en el sistema.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleCheckForUpdates}
            disabled={checkForUpdates.isPending}
            className="h-10 shrink-0 gap-2 self-start rounded-xl sm:self-center"
          >
            <RefreshCw className={checkForUpdates.isPending ? 'size-4 animate-spin' : 'size-4'} />
            Buscar actualizaciones
          </Button>
        </div>

        {checkForUpdates.isError && (
          <div className="mt-4">
            <ErrorAlert>{getSettingsErrorMessage(checkForUpdates.error)}</ErrorAlert>
          </div>
        )}

        {upToDateChecked && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            <CheckCircle2 className="size-4 shrink-0" />
            El catálogo CABYS ya se encuentra actualizado.
          </div>
        )}

        {checkForUpdates.data?.hasUpdate && !preview && !applyResult && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Se encontró una versión nueva del catálogo publicada por el BCCR.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadAndCompare}
              disabled={previewUpdate.isPending}
              className="h-9 shrink-0 self-start rounded-lg sm:self-center"
            >
              {previewUpdate.isPending ? 'Descargando y comparando...' : 'Descargar y comparar'}
            </Button>
          </div>
        )}

        {previewUpdate.isError && (
          <div className="mt-4">
            <ErrorAlert>{getSettingsErrorMessage(previewUpdate.error)}</ErrorAlert>
          </div>
        )}

        {applyUpdate.isError && (
          <div className="mt-4">
            <ErrorAlert>{getSettingsErrorMessage(applyUpdate.error)}</ErrorAlert>
          </div>
        )}

        {applyResult && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              <CheckCircle2 className="size-4 shrink-0" />
              Catálogo actualizado correctamente.
            </div>

            <DiffSummaryList summary={applyResult.summary} />

            {applyResult.productsToReview.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  {applyResult.productsToReview.length} producto(s) requieren revisión manual
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  El impuesto seleccionado ya no coincide con el nuevo impuesto oficial del código
                  CABYS. Ningún producto fue modificado automáticamente.
                </p>

                <ul className="mt-3 flex flex-col gap-2">
                  {applyResult.productsToReview.map((product) => (
                    <li
                      key={product.productId}
                      className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{product.productName}</span>
                      <span className="text-xs text-muted-foreground">
                        CABYS {product.cabysCode} · impuesto actual: {product.currentTaxName} (
                        {product.currentTaxRate}%) · impuesto oficial:{' '}
                        {product.officialTaxRate !== null ? `${product.officialTaxRate}%` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Se encontró una nueva versión del catálogo CABYS</DialogTitle>
            <DialogDescription>Revisá los cambios antes de aplicarlos.</DialogDescription>
          </DialogHeader>

          {preview && <DiffSummaryList summary={preview.summary} />}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={applyUpdate.isPending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmUpdate} disabled={applyUpdate.isPending}>
              {applyUpdate.isPending ? 'Actualizando...' : '¿Desea actualizar?'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DiffSummaryList({
  summary,
}: {
  summary: PreviewCabysCatalogUpdateResult['summary']
}) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      <li className="flex items-center justify-between">
        <span className="text-muted-foreground">Códigos nuevos</span>
        <Badge variant="secondary">{summary.newCodesCount}</Badge>
      </li>
      <li className="flex items-center justify-between">
        <span className="text-muted-foreground">Descripciones modificadas</span>
        <Badge variant="muted">{summary.descriptionChangedCount}</Badge>
      </li>
      <li className="flex items-center justify-between">
        <span className="text-muted-foreground">Impuestos modificados</span>
        <Badge variant="muted">{summary.taxIndicatorChangedCount}</Badge>
      </li>
      <li className="flex items-center justify-between">
        <span className="text-muted-foreground">Códigos retirados</span>
        <Badge variant="destructive">{summary.retiredCodesCount}</Badge>
      </li>
    </ul>
  )
}
