import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail } from 'lucide-react'
import { z } from 'zod'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { alegraApi } from '@/features/settings/api/alegra.api'
import { getAlegraActionErrorMessage } from '../hooks/useSaleDocumentActions'

/**
 * features/sales/components/SaleResendDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.20 — "Reenviar" (pestaña Documentos, `SaleDetailContent.tsx`).
 * Reutiliza exactamente `POST /integrations/alegra/sales/:saleId/email`
 * (que a su vez llama a `POST /invoices/{id}/email` de Alegra sobre el
 * comprobante YA emitido, sin re-timbrar ni volver a comunicar con
 * Hacienda) — este componente solo pide el correo de destino y muestra el
 * resultado.
 *
 * Bloque 8.4: si la venta tiene un cliente asociado con correo cargado
 * (`customerEmail`, `Sale.customer.email`), ya NO se pide el correo a
 * mano — se muestra una pantalla de confirmación con ese correo (de solo
 * lectura) y un botón "Enviar", reutilizando el correo real del cliente
 * (módulo de Clientes, Bloque 8.2) sin duplicarlo en ningún estado nuevo
 * de este componente. Sigue pidiéndolo manualmente cuando la venta es
 * "Público General" o el cliente asociado no tiene correo cargado — mismo
 * formulario de siempre, sin cambios.
 */
const resendEmailSchema = z.object({
  email: z
    .string()
    .min(1, 'El correo es obligatorio.')
    .email('El correo electrónico no es válido.'),
})

type ResendEmailValues = z.infer<typeof resendEmailSchema>

type SendStatus = 'idle' | 'sending' | 'success' | 'error'

interface SaleResendDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin estado propio. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `Sale.id` — el backend resuelve `alegraInvoiceId` a partir de esto,
   * el correo nunca viaja junto a datos de la venta que no necesita. */
  saleId: string
  /** Bloque 8.4: correo del cliente asociado a la venta (`Sale.customer.email`)
   * — cuando esta presente, se usa automaticamente y no se pide a mano.
   * `null`/`undefined` (Público General, o cliente sin correo cargado)
   * mantiene el formulario manual de siempre. */
  customerEmail?: string | null
}

export function SaleResendDialog({
  open,
  onOpenChange,
  saleId,
  customerEmail,
}: SaleResendDialogProps) {
  const [status, setStatus] = useState<SendStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResendEmailValues>({
    resolver: zodResolver(resendEmailSchema),
  })

  // Reinicia el dialogo (formulario + estado de envio) cada vez que se
  // cierra — sin esto, reabrirlo para otra venta mostraria el resultado
  // (exito/error) del reenvio anterior.
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset()
      setStatus('idle')
      setErrorMessage(null)
    }
    onOpenChange(nextOpen)
  }

  const sendTo = async (email: string) => {
    setStatus('sending')
    setErrorMessage(null)

    try {
      await alegraApi.sendInvoiceEmail(saleId, email)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        getAlegraActionErrorMessage(
          error,
          'No se pudo reenviar el comprobante. Intenta de nuevo.',
        ),
      )
    }
  }

  const onSubmitManual = (values: ResendEmailValues) => sendTo(values.email)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reenviar comprobante</DialogTitle>
          <DialogDescription>
            {customerEmail
              ? 'Se reenviará el comprobante electrónico ya emitido al correo del cliente.'
              : 'Se reenviará el comprobante electrónico ya emitido al correo que indiques.'}
          </DialogDescription>
        </DialogHeader>

        {status === 'success' ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Comprobante enviado correctamente.
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : customerEmail ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-input bg-muted/40 px-3.5 py-2.5">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-foreground">{customerEmail}</span>
            </div>

            {status === 'error' && errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}

            <DialogFooter>
              <Button
                type="button"
                disabled={status === 'sending'}
                onClick={() => sendTo(customerEmail)}
              >
                {status === 'sending' ? 'Enviando...' : 'Enviar'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmitManual)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sale-resend-email">
                Correo de destino
                <RequiredMark />
              </Label>
              <Input
                id="sale-resend-email"
                type="email"
                placeholder="cliente@correo.com"
                disabled={status === 'sending'}
                aria-invalid={!!errors.email}
                autoFocus
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {status === 'error' && errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}

            <DialogFooter>
              <Button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando...' : 'Enviar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
