import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DoorClosed } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FormSection } from '@/components/ui/FormSection'
import { LoadingState } from '@/components/ui/LoadingState'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { useCashRegisters } from '@/features/cashRegisters/hooks/useCashRegisters'
import { useCashSession } from '../hooks/useCashSession'
import { useCloseCashSession } from '../hooks/useCloseCashSession'
import { useCashSessionStore } from '../store/cashSessionStore'
import { CloseCashSessionForm } from '../components/CloseCashSessionForm'
import { getCashSessionErrorMessage } from '../utils/cashSessionErrors'
import type { CloseCashSessionDto } from '../types/cashSession.types'

export function CloseCashSessionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: cashSession,
    isLoading,
    isError,
    error,
  } = useCashSession(id ?? '')
  const {
    mutate: closeCashSession,
    isPending,
    isError: isCloseError,
    error: closeError,
  } = useCloseCashSession()
  const clearCashSessionId = useCashSessionStore(
    (state) => state.clearCashSessionId,
  )

  // Mismo hook ya usado en OpenCashSessionForm.tsx/OpenCashSessionPage.tsx
  // para resolver el nombre de la caja registradora — `CashSession` solo
  // trae `cashRegisterId`, no el nombre resuelto.
  const { data: cashRegistersResponse } = useCashRegisters({ active: true })
  const cashRegisterName = cashRegistersResponse?.data.find(
    (cashRegister) => cashRegister.id === cashSession?.cashRegisterId,
  )?.name

  const handleSubmit = (values: CloseCashSessionDto) => {
    if (!id) {
      return
    }

    closeCashSession(
      { id, dto: values },
      {
        onSuccess: () => {
          clearCashSessionId()
          navigate('/cash-session/open')
          toast.success('Caja cerrada correctamente')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/cash-session/open')
  }

  if (isLoading) {
    return <LoadingState message="Cargando sesión de caja..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar la sesión de caja.'}
      </ErrorAlert>
    )
  }

  if (!cashSession) {
    return (
      <p className="text-sm text-muted-foreground">
        La sesión de caja no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Caja', href: '/cash-session/open' },
          { label: 'Cerrar caja' },
        ]}
        title="Cerrar caja"
        description="Revisa el resumen de la sesión antes de confirmar el cierre."
      />

      <FormSection icon={DoorClosed} title="Sesión activa" description="Datos de la sesión que se va a cerrar.">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Caja
              </span>
              <span className="font-medium">{cashRegisterName ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Sucursal
              </span>
              <span className="font-medium">{cashSession.sucursal.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Abierta por
              </span>
              <span className="font-medium">{cashSession.openedBy.fullName}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Hora de apertura
              </span>
              <span className="font-medium">{formatDateTime(cashSession.openedAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Monto de apertura
              </span>
              <span className="font-semibold text-brand">
                {formatCurrency(cashSession.openingAmount)}
              </span>
            </div>
          </div>

          {isCloseError && <ErrorAlert>{getCashSessionErrorMessage(closeError)}</ErrorAlert>}

          <CloseCashSessionForm
            isSubmitting={isPending}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </FormSection>
    </div>
  )
}
