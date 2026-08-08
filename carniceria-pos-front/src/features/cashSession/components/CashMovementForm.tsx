import { useEffect, useRef } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
import { formatCurrency } from '@/utils/formatCurrency'
import { createCashMovementSchema } from '../schema/cashSession.schema'
import { useCreateCashMovement } from '../hooks/useCreateCashMovement'
import { getCashSessionErrorMessage } from '../utils/cashSessionErrors'
import type { CreateCashMovementDto } from '../types/cashSession.types'

// QA.5 (Caja): tipado sobre `'CASH_IN' | 'CASH_OUT'` explícitos, no sobre
// `CashMovementType` completo (que desde este bloque también incluye
// `'REFUND'`) — este formulario es exclusivamente de creación MANUAL, y
// `createCashMovementSchema`/`CreateCashMovementSchema` (backend) nunca
// aceptan `REFUND` ahí (solo lo genera el flujo de Devoluciones).
const MOVEMENT_TYPE_LABELS: Record<'CASH_IN' | 'CASH_OUT', string> = {
  CASH_IN: 'Ingreso de efectivo',
  CASH_OUT: 'Egreso de efectivo',
}

interface CashMovementFormProps {
  /** Si el dialogo/modal que contiene este formulario esta abierto. El
   * componente sigue sin conocer ningun dialogo especifico ni decidir
   * cuando abrirse/cerrarse — solo usa esta senal para saber cuando
   * empieza un intento nuevo y resetear el estado de la mutacion de un
   * intento anterior (ver `useEffect` mas abajo). */
  open: boolean
  /** Sesion de caja activa a la que se asocia el movimiento. */
  cashSessionId: string
  /** Se dispara cuando el movimiento se registra correctamente. */
  onSuccess: () => void
  /** Rediseño de Caja: preselecciona el tipo — usado por las acciones
   * rápidas "Registrar ingreso"/"Registrar egreso" (pestaña "Movimientos")
   * para saltar el selector cuando el tipo ya se sabe de antemano.
   * Aditivo: por defecto `undefined`, mismo comportamiento de siempre
   * (selector vacío) para quien no lo pase. */
  initialType?: 'CASH_IN' | 'CASH_OUT'
}

/**
 * Formulario de registro de movimientos de caja (ingreso/egreso de
 * efectivo). Pensado para integrarse dentro de un dialogo/modal del POS
 * (ver `SalesPOSPage.tsx`), sin navegacion propia — no conoce ningun
 * dialogo ni decide cuando abrirse/cerrarse, solo notifica exito via
 * `onSuccess`. Mismo criterio de autocontencion que `OpenCashSessionForm`.
 *
 * Nota sobre `reason`: el Design System del proyecto no incluye
 * actualmente un componente `Textarea` (verificado contra
 * `components/ui/`), por lo que se usa `Input`, igual que el resto de
 * los campos de texto corto del formulario.
 *
 * Pulido visual del POS (aprobado, "el diálogo debe sentirse como una
 * herramienta profesional"): ÚNICAMENTE presentación, ningún hook/campo/
 * validación nuevo. "Tipo de movimiento" gana un contenedor propio
 * (bloque `border`/`bg-muted`) con una descripción que cambia sola según
 * `field.value` — el mismo valor que el `Controller` ya expone, sin
 * estado ni lógica adicional (ni siquiera un `useWatch`: se lee el mismo
 * `field.value` de siempre). "Monto" reutiliza EXACTO el mismo patrón de
 * campo protagonista ya usado en `OpenCashSessionForm.tsx` ("Monto
 * inicial" de Apertura de caja): prefijo `₡` + número grande dentro de un
 * bloque `border`/`bg-muted`, mismo `Input` con las mismas clases.
 *
 * Nota sobre la integracion del `Select` para `type`: replica
 * exactamente el patron de `OpenCashSessionForm.tsx` (campo
 * `cashRegisterId`) — `field` se usa como objeto completo dentro del
 * render del `Controller`, sin desestructurar ni esparcir sobre
 * `<Select>`, ya que `SelectRoot` no acepta una prop `ref` generica.
 * Nota sobre `open` y `resetMutation`: `CashMovementForm` permanece
 * montado durante toda la sesion de POS (ver `SalesPOSPage.tsx`, que lo
 * renderiza condicionado por `cashSessionId`, no por el estado del
 * dialogo) — por lo tanto la instancia de `useCreateCashMovement()`
 * tambien persiste entre aperturas del dialogo. Si una mutacion queda
 * pendiente sin asentarse, `isPending` deshabilitaria permanentemente
 * los campos del formulario en cada reapertura posterior. `open` es la
 * unica senal disponible para detectar una apertura nueva; se usa
 * exclusivamente para resetear el estado de la mutacion (TanStack
 * Query) en esa transicion — no el `reset()` de React Hook Form
 * (valores del formulario), que se mantiene sin cambios.
 */
export function CashMovementForm({
  open,
  cashSessionId,
  onSuccess,
  initialType,
}: CashMovementFormProps) {
  const {
    mutate: createCashMovement,
    isPending,
    isError,
    error,
    reset: resetMutation,
  } = useCreateCashMovement()

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateCashMovementDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CreateCashMovementDto>` que expone
    // cashSession.schema.ts (no se modifica ese archivo desde aqui).
    // Mismo cast usado en OpenCashSessionForm.tsx/ProductForm.tsx por el
    // mismo motivo.
    resolver: zodResolver(createCashMovementSchema as never) as unknown as Resolver<CreateCashMovementDto>,
    defaultValues: {
      cashSessionId,
      type: initialType,
    },
  })

  // Si `cashSessionId` cambia despues del render inicial (la sesion
  // activa cambia mientras el dialogo permanece montado), el campo
  // oculto del formulario debe reflejarlo — `defaultValues` solo aplica
  // una vez, en el primer render.
  useEffect(() => {
    setValue('cashSessionId', cashSessionId)
  }, [cashSessionId, setValue])

  // Detecta especificamente la transicion cerrado -> abierto (no cada
  // render mientras el dialogo permanece abierto, ni el montaje inicial
  // — ver nota en el comentario de la funcion). `previousOpenRef` arranca
  // con el valor de `open` en el montaje, por lo que la primera
  // ejecucion de este efecto nunca detecta una transicion, sin importar
  // si `open` empieza en `true` o `false`.
  const previousOpenRef = useRef(open)

  useEffect(() => {
    const wasClosed = !previousOpenRef.current
    const isNowOpen = open

    if (wasClosed && isNowOpen) {
      resetMutation()
      // Rediseño de Caja: cada apertura nueva vuelve a preseleccionar
      // `initialType` (mismo criterio que `cashSessionId` en el efecto de
      // arriba) — "Registrar ingreso" siempre abre con Ingreso ya
      // elegido, aunque el intento anterior haya sido un Egreso.
      reset({ cashSessionId, type: initialType })
    }

    previousOpenRef.current = open
  }, [open, cashSessionId, initialType, resetMutation, reset])

  const submit = handleSubmit((values) => {
    createCashMovement(values, {
      onSuccess: () => {
        reset({ cashSessionId, type: initialType })
        onSuccess()
        // Bloque POS-08: evento puntual de exito, hoy silencioso (solo
        // cerraba el dialogo). El `ErrorAlert` de abajo sigue siendo el
        // unico feedback de error de este formulario, sin cambios.
        toast.success('Movimiento registrado', {
          description: `${MOVEMENT_TYPE_LABELS[values.type as 'CASH_IN' | 'CASH_OUT']} por ${formatCurrency(values.amount)}`,
        })
      },
    })
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
        <Label htmlFor="cash-movement-type" className="text-sm font-semibold">
          Tipo de movimiento
        </Label>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <>
              <Select
                value={field.value ?? ''}
                onValueChange={(value: unknown) =>
                  field.onChange(value as 'CASH_IN' | 'CASH_OUT')
                }
              >
                <SelectTrigger
                  id="cash-movement-type"
                  disabled={isPending}
                  aria-invalid={!!errors.type}
                  className="h-12 rounded-xl bg-card text-base"
                >
                  {/*
                    @base-ui/react Select.Value no deriva el label de los
                    Select.Item renderizados. Se resuelve manualmente,
                    mismo criterio que OpenCashSessionForm.tsx con las
                    cajas registradoras.
                  */}
                  <SelectValue>
                    {(value: unknown) => {
                      const type = value as 'CASH_IN' | 'CASH_OUT'
                      if (!type) {
                        return 'Selecciona un tipo'
                      }
                      return MOVEMENT_TYPE_LABELS[type]
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH_IN">
                    {MOVEMENT_TYPE_LABELS.CASH_IN}
                  </SelectItem>
                  <SelectItem value="CASH_OUT">
                    {MOVEMENT_TYPE_LABELS.CASH_OUT}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Descripción contextual (aprobado): se actualiza sola con
                  el mismo `field.value` de arriba, sin ningún estado
                  nuevo. */}
              {field.value && (
                <p className="text-xs text-muted-foreground">
                  {field.value === 'CASH_IN'
                    ? 'Se sumará este monto al efectivo esperado en caja.'
                    : 'Se restará este monto del efectivo esperado en caja.'}
                </p>
              )}
            </>
          )}
        />
        {errors.type && (
          <p className="text-sm text-destructive">{errors.type.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cash-movement-amount" className="text-sm font-semibold">
          Monto
        </Label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="text-2xl font-bold text-muted-foreground">₡</span>
          <Input
            id="cash-movement-amount"
            type="number"
            step="0.01"
            disabled={isPending}
            aria-invalid={!!errors.amount}
            className="h-auto border-0 bg-transparent p-0 text-3xl font-extrabold tabular-nums shadow-none focus-visible:ring-0"
            {...register('amount', { valueAsNumber: true })}
          />
        </div>
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cash-movement-reason" className="text-sm font-semibold">
          Motivo
        </Label>
        <Input
          id="cash-movement-reason"
          disabled={isPending}
          aria-invalid={!!errors.reason}
          className="h-12 rounded-xl text-base"
          {...register('reason')}
        />
        {errors.reason && (
          <p className="text-sm text-destructive">{errors.reason.message}</p>
        )}
      </div>

      {isError && <ErrorAlert>{getCashSessionErrorMessage(error)}</ErrorAlert>}

      <Button type="submit" size="xl" disabled={isPending} className="w-full shadow-sm">
        {isPending ? 'Registrando...' : 'Registrar movimiento'}
      </Button>
    </form>
  )
}