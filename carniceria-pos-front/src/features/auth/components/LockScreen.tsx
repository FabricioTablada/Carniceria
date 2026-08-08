import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthBackdrop } from '@/layouts/AuthLayout'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '../api/auth.api'
import { getAuthErrorMessage } from '../hooks/useLogin'

interface LockScreenProps {
  onUnlock: () => void
}

/**
 * features/auth/components/LockScreen.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.24 (bloqueo automatico por inactividad, NO logout): overlay
 * montado por `App.tsx` por encima de `<AppRouter/>` — no navega, no
 * desmonta nada, no toca `accessToken`/`refreshToken`/`cashSessionId`.
 * Pide unicamente la contrasena del usuario ya autenticado
 * (`authStore.user`), vía `POST /auth/verify-password` (nunca `login()`,
 * ver justificacion en `auth.service.ts` del backend — evita compartir el
 * cupo estricto de `loginRateLimiter` y no rota ningun token).
 *
 * Bloqueo real de interaccion (no solo visual):
 * - El overlay cubre todo el viewport (`fixed inset-0`) con fondo opaco —
 *   bloquea el mouse por semantica normal de DOM/CSS (un `div` sin
 *   `pointer-events-none` intercepta los clicks, nada debajo lo recibe).
 * - Los atajos de teclado de las paginas (POS, listados) son listeners
 *   crudos en `window` sin ninguna nocion de "hay un dialogo abierto" (ver
 *   `SalesPOSPage.tsx`) — una superposicion visual NO los detiene, un
 *   evento de teclado llega a `window` sin importar el z-index. Por eso
 *   este componente agrega su propio listener de captura
 *   (`{ capture: true }`) que corre ANTES que cualquier listener de fase
 *   de burbuja ya registrado por otras paginas, y llama a
 *   `stopImmediatePropagation()` — neutraliza esos atajos mientras esta
 *   montado, sin tocar ni un archivo de esas paginas.
 * - Procesos de fondo (refresh silencioso, actualizador, watchdog, sync
 *   worker) no escuchan eventos de teclado/mouse ni dependen del arbol de
 *   React — no se ven afectados por ninguno de los dos puntos anteriores.
 *
 * Bloque 7.26 (05/08/2026): reutiliza exactamente el mismo fondo del
 * Login (`AuthBackdrop`, ver `layouts/AuthLayout.tsx`) y el mismo estilo
 * de tarjeta/branding de `LoginForm.tsx` — pedido explicito del usuario
 * para que ambas pantallas se sientan parte del mismo producto. Única
 * diferencia real entre las dos pantallas: el contenido de la tarjeta.
 */
export function LockScreen({ onUnlock }: LockScreenProps) {
  const user = useAuthStore((state) => state.user)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    mutate: verifyPassword,
    isPending,
    error,
    reset,
  } = useMutation({
    mutationFn: (value: string) => authApi.verifyPassword(value),
    onSuccess: () => {
      setPassword('')
      onUnlock()
    },
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const blockKeyboard = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
    }

    window.addEventListener('keydown', blockKeyboard, { capture: true })
    return () => window.removeEventListener('keydown', blockKeyboard, { capture: true })
  }, [])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!password) return
    verifyPassword(password)
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden">
      <AuthBackdrop />
      <Card className="relative z-10 w-full max-w-sm gap-0 rounded-2xl border border-border/50 bg-card/90 py-8 shadow-2xl shadow-black/15 backdrop-blur-md">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-brand/15 text-[0.6875rem] font-bold text-brand">
              C
            </span>
            <span className="text-[1.0625rem] font-bold tracking-tight">
              Carnicería <span className="text-brand">POS</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Lock className="size-4 text-muted-foreground" />
              Sesión bloqueada
            </CardTitle>
            <CardDescription className="text-sm">
              {user?.fullName ? `${user.fullName} — ingresá tu contraseña para continuar` : 'Ingresá tu contraseña para continuar'}
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="flex flex-col gap-5 pt-8">
            {error && <ErrorAlert>{getAuthErrorMessage(error)}</ErrorAlert>}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unlock-password">Contraseña</Label>
              <div className="relative">
                <Input
                  ref={inputRef}
                  id="unlock-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isPending}
                  className="h-10 pr-9"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (error) reset()
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-8">
            <Button
              type="submit"
              className="h-10 w-full text-sm font-semibold shadow-sm"
              disabled={isPending || !password}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? 'Verificando...' : 'Desbloquear'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
