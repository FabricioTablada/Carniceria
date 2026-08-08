import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
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
import { useAuthStore } from '@/stores/authStore'
import { loginSchema, type LoginFormValues } from '../schemas/auth.schema'
import { getAuthErrorMessage, useLogin } from '../hooks/useLogin'

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending, error } = useLogin()
  // Bloque 7.24: recordar unicamente el ultimo usuario utilizado (comodidad
  // pedida explicitamente) — `authStore.user` ya persiste en `localStorage`
  // desde antes de este bloque (A-01), solo faltaba leerlo aca. Nunca
  // precarga la contrasena.
  const rememberedUsername = useAuthStore((state) => state.user?.username ?? '')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: rememberedUsername,
      password: '',
    },
  })

  const onSubmit = (values: LoginFormValues) => {
    login(values)
  }

  return (
    <Card className="w-full gap-0 rounded-2xl border border-border/50 bg-card/90 py-8 shadow-2xl shadow-black/15 backdrop-blur-md">
      <CardHeader className="flex flex-col gap-4">
        {/* Bloque 7.26: reemplaza al logo de Pipasa — marca "C" chica y
         * de bajo contraste (placeholder, depende del branding definitivo
         * — ROADMAP.md, roadmap de diseño ítem 3) + wordmark como
         * elemento principal, mismo criterio ya aprobado en la ventana de
         * actualización (Bloque 7.25) para consistencia entre pantallas. */}
        <div className="flex items-center gap-2">
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-brand/15 text-[0.6875rem] font-bold text-brand">
            C
          </span>
          <span className="text-[1.0625rem] font-bold tracking-tight">
            Carnicería <span className="text-brand">POS</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Bienvenido
          </CardTitle>
          <CardDescription className="text-sm">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-5 pt-8">
          {error && <ErrorAlert>{getAuthErrorMessage(error)}</ErrorAlert>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="usuario"
              aria-invalid={!!errors.username}
              disabled={isPending}
              className="h-10"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-sm text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                disabled={isPending}
                className="h-10 pr-9"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-8">
          <Button
            type="submit"
            className="h-10 w-full text-sm font-semibold shadow-sm"
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </Button>
          {/* Bloque 7.26: pie de tarjeta mas elegante (separador + una
           * linea centrada) — sin numero de version: esta app web no
           * tiene hoy ninguna fuente real de version en tiempo de
           * ejecucion (a diferencia de la app de escritorio, que la lee
           * de Electron), y no se inventa un valor que no existe. */}
          <p className="w-full border-t border-border/50 pt-3 text-center text-[0.6875rem] tracking-wide text-muted-foreground">
            Carnicería POS
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
