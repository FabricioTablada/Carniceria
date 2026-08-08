import { useState } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AlertTriangle, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/utils/formatDateTime'
import { useAuthStore } from '@/stores/authStore'
import { useCashRegisters } from '@/features/cashRegisters/hooks/useCashRegisters'
import { openCashSessionSchema } from '../schema/cashSession.schema'
import { useCashSessions } from '../hooks/useCashSessions'
import { useOpenCashSession } from '../hooks/useOpenCashSession'
import { useCashSessionStore } from '../store/cashSessionStore'
import { getCashSessionErrorMessage } from '../utils/cashSessionErrors'
import type { OpenCashSessionDto } from '../types/cashSession.types'

const textareaClassName =
  'flex min-h-16 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** Mismo par etiqueta/valor que el resto del Design System (Ventas/Compras,
 * `Field` local de `SaleDetailContent.tsx`) — resumen contextual de
 * "qué se está por abrir", sin ningún dato nuevo (usuario ya autenticado,
 * caja seleccionada en el propio formulario, hora actual). */
function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="truncate text-sm font-semibold">{value}</span>
    </div>
  )
}

interface OpenCashSessionFormProps {
  /** Se dispara despues de abrir la sesion correctamente (aditivo,
   * `undefined` por defecto) — el unico consumidor actual lo usa para
   * cerrar el `WorkspacePanel` que lo contiene. */
  onSuccess?: () => void
  /** Boton "Cancelar" opcional en el pie del formulario (aditivo,
   * `undefined` por defecto = sin boton, mismo criterio ya usado en
   * `CloseCashSessionForm.tsx`). */
  onCancel?: () => void
}

/**
 * Formulario de apertura de sesion de caja. Autocontenido: carga las cajas
 * disponibles (`useCashRegisters`), ejecuta la mutacion de apertura
 * (`useOpenCashSession`) y guarda el `cashSessionId` resultante en
 * `cashSessionStore`. No navega ni conoce `RequireCashSession` — eso le
 * corresponde a quien lo use (`CashSessionsPage`), que puede reaccionar al
 * cambio de `cashSessionId` en el store para decidir que hacer despues.
 *
 * La sesion pertenece a la caja registradora, no al usuario — por eso este
 * formulario tambien consulta las sesiones `OPEN` existentes
 * (`useCashSessions`, mismo patron que `useCashRegisters`/`useUsers`) para
 * marcar en el `Select` que cajas ya tienen una sesion abierta, en vez de
 * dejar que el usuario la elija y se entere recien al enviar (409 del
 * backend, que se sigue mostrando igual si de todas formas ocurre por una
 * condicion de carrera).
 *
 * Rediseño de Caja — Apertura (aprobado, "convertir en un verdadero Canvas
 * Workspace"): ÚNICAMENTE presentación — mismos hooks, mismo `useForm`,
 * misma validación (`openCashSessionSchema`), mismo `onSuccess`/toast, cero
 * cambio de flujo. Se agrega:
 *  - Hero superior ("Caja cerrada"): este componente SOLO se renderiza
 *    cuando no hay sesión activa (`CashSessionsPage.tsx` decide eso antes
 *    de montarlo), así que el estado siempre es "cerrada, lista para
 *    abrir" — no hay una rama "caja abierta" que dibujar aca sin duplicar
 *    la vista operativa que la página ya muestra en ese caso.
 *  - Resumen contextual (Cajero/Sucursal/Caja/Fecha y hora): datos ya
 *    disponibles (usuario autenticado, caja elegida en el propio Select,
 *    hora actual) — ningún cálculo ni consulta nueva.
 *  - "Monto inicial" con protagonismo visual (input grande, tabular).
 *  - Aviso elegante de cajas ya abiertas: mismo `openCashRegisterIds` de
 *    siempre, ahora también resumido en una nota visible (antes solo se
 *    notaba mirando las opciones deshabilitadas del Select).
 *  - Acciones al pie, separadas por un borde superior — mismo criterio
 *    visual que `WorkspacePanelFooter`/el resto de formularios del ERP.
 */
export function OpenCashSessionForm({ onSuccess, onCancel }: OpenCashSessionFormProps = {}) {
  const user = useAuthStore((state) => state.user)
  const [openedAt] = useState(() => new Date().toISOString())

  const { data: cashRegistersResponse, isLoading: isLoadingCashRegisters } =
    useCashRegisters({ active: true })
  const cashRegisters = cashRegistersResponse?.data ?? []

  const { data: openSessionsResponse } = useCashSessions({ status: 'OPEN' })
  const openCashRegisterIds = new Set(
    (openSessionsResponse?.data ?? []).map(
      (session) => session.cashRegisterId,
    ),
  )

  const { mutate: openCashSession, isPending, isError, error } =
    useOpenCashSession()
  const setCashSessionId = useCashSessionStore((state) => state.setCashSessionId)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OpenCashSessionDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<OpenCashSessionDto>` que expone
    // cashSession.schema.ts (no se modifica ese archivo desde aqui).
    // Mismo cast usado en ProductForm.tsx/CategoryForm.tsx por el mismo
    // motivo.
    resolver: zodResolver(openCashSessionSchema as never) as unknown as Resolver<OpenCashSessionDto>,
  })

  const cashRegisterIdValue = useWatch({ control, name: 'cashRegisterId' })
  const selectedCashRegister = cashRegisters.find(
    (cashRegister) => cashRegister.id === cashRegisterIdValue,
  )

  const submit = handleSubmit((values) => {
    openCashSession(values, {
      onSuccess: (session) => {
        setCashSessionId(session.id)
        // Bloque POS-08: evento puntual de exito, hoy silencioso (solo
        // cambiaba de vista) — el `ErrorAlert` de abajo sigue siendo el
        // unico feedback de error de este formulario, sin cambios.
        toast.success('Caja abierta correctamente')
        onSuccess?.()
      },
    })
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Wallet className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand">Caja cerrada</p>
          <p className="text-xs text-muted-foreground">Completa los datos para iniciar tu turno.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <ContextField label="Cajero" value={user?.fullName ?? '—'} />
        <ContextField label="Sucursal" value={selectedCashRegister?.sucursal.name ?? '—'} />
        <ContextField label="Caja" value={selectedCashRegister?.name ?? 'Sin seleccionar'} />
        <ContextField label="Fecha y hora" value={formatDateTime(openedAt)} />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border/70 pt-5">
        <Label htmlFor="open-cash-session-cashRegisterId">
          Caja registradora
        </Label>
        <Controller
          control={control}
          name="cashRegisterId"
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(value: unknown) => field.onChange(value as string)}
            >
              <SelectTrigger
                id="open-cash-session-cashRegisterId"
                disabled={isPending || isLoadingCashRegisters}
                aria-invalid={!!errors.cashRegisterId}
              >
                {/*
                  @base-ui/react Select.Value no deriva el label de los
                  Select.Item renderizados. Se resuelve manualmente
                  buscando en `cashRegisters`.
                */}
                <SelectValue>
                  {(value: unknown) => {
                    const cashRegisterId = value as string
                    if (!cashRegisterId) {
                      return isLoadingCashRegisters
                        ? 'Cargando cajas...'
                        : 'Selecciona una caja'
                    }
                    return (
                      cashRegisters.find(
                        (cashRegister) => cashRegister.id === cashRegisterId,
                      )?.name ?? cashRegisterId
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cashRegisters.map((cashRegister) => {
                  const isCashRegisterOpen = openCashRegisterIds.has(
                    cashRegister.id,
                  )

                  return (
                    <SelectItem
                      key={cashRegister.id}
                      value={cashRegister.id}
                      disabled={isCashRegisterOpen}
                    >
                      {cashRegister.name}
                      {isCashRegisterOpen && ' (caja abierta)'}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        />
        {errors.cashRegisterId && (
          <p className="text-sm text-destructive">
            {errors.cashRegisterId.message}
          </p>
        )}
        {openCashRegisterIds.size > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5 shrink-0" />
            {openCashRegisterIds.size === 1
              ? 'Hay 1 caja con una sesión abierta — no aparece disponible.'
              : `Hay ${openCashRegisterIds.size} cajas con una sesión abierta — no aparecen disponibles.`}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="open-cash-session-openingAmount">
          Monto inicial
        </Label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="text-2xl font-bold text-muted-foreground">₡</span>
          <Input
            id="open-cash-session-openingAmount"
            type="number"
            step="0.01"
            disabled={isPending}
            aria-invalid={!!errors.openingAmount}
            className="h-auto border-0 bg-transparent p-0 text-3xl font-extrabold tabular-nums shadow-none focus-visible:ring-0"
            {...register('openingAmount', { valueAsNumber: true })}
          />
        </div>
        {errors.openingAmount && (
          <p className="text-sm text-destructive">
            {errors.openingAmount.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="open-cash-session-notes">
          Observaciones (opcional)
        </Label>
        <textarea
          id="open-cash-session-notes"
          disabled={isPending}
          aria-invalid={!!errors.notes}
          className={textareaClassName}
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {isError && <ErrorAlert>{getCashSessionErrorMessage(error)}</ErrorAlert>}

      <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isPending || isLoadingCashRegisters}>
          {isPending ? 'Abriendo caja...' : 'Abrir caja'}
        </Button>
      </div>
    </form>
  )
}
