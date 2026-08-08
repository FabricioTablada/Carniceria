import { useState, type InputHTMLAttributes } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, SlidersHorizontal, User, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { createUserSchema, updateUserSchema } from '../schemas/user.schema'
import { RolePermissionsPreview } from './RolePermissionsPreview'
import type { CreateUserDto } from '../types/user.types'

interface SelectOption {
  id: string
  name: string
  /** Bloque Usuarios (aprobado, "vista previa del rol"): mismo
   * `permissions[]` que ya devuelve `GET /roles` (`Role.permissions`) —
   * antes `CreateUserPage.tsx`/`EditUserPage.tsx` lo descartaban al
   * mapear a `{ id, name }`. Opcional para no romper ningún otro
   * consumidor hipotético de este tipo que no lo tenga disponible. */
  permissions?: { id: string; code: string; description: string | null }[]
}

interface UserFormProps {
  mode: 'create' | 'update'
  defaultValues?: Partial<CreateUserDto>
  roles: SelectOption[]
  isSubmitting?: boolean
  onSubmit: (values: CreateUserDto) => void
  onCancel?: () => void
}

/**
 * Genera una contraseña aleatoria "fuerte" con `crypto.getRandomValues`
 * (Web Crypto, sin dependencias nuevas) — garantiza al menos una
 * mayúscula/minúscula/dígito/símbolo por construcción y el resto de los
 * caracteres al azar, mezclados con Fisher-Yates. Solo genera un VALOR
 * de sugerencia visual para el input: no valida nada ni reemplaza las
 * reglas de `user.schema.ts`, que siguen aplicándose igual que a
 * cualquier contraseña tipeada a mano.
 */
function secureRandomInt(maxExclusive: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0]! % maxExclusive
}

function generateSecurePassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*-_=+?'
  const all = upper + lower + digits + symbols
  const pick = (pool: string) => pool[secureRandomInt(pool.length)]!

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < length) {
    chars.push(pick(all))
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }

  return chars.join('')
}

/**
 * Fortaleza de contraseña (aprobado, "ayuda visual, no una regla nueva de
 * seguridad"): heurística puramente de presentación — longitud + variedad
 * de tipos de caracter — que NUNCA se usa para bloquear el envío del
 * formulario (eso lo sigue haciendo únicamente `user.schema.ts`, sin
 * cambios). "Débil"/"Media"/"Fuerte" son solo una guía en tiempo real
 * mientras se escribe.
 */
interface PasswordStrength {
  label: string
  level: 0 | 1 | 2 | 3
  barClass: string
  textClass: string
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { label: 'Débil', level: 1, barClass: 'bg-destructive', textClass: 'text-destructive' }
  if (score <= 4) return { label: 'Media', level: 2, barClass: 'bg-accent-amber', textClass: 'text-accent-amber' }
  return { label: 'Fuerte', level: 3, barClass: 'bg-success', textClass: 'text-success' }
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) {
    return null
  }

  const strength = getPasswordStrength(password)

  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((segment) => (
          <div
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full bg-muted transition-colors duration-200',
              segment <= strength.level && strength.barClass,
            )}
          />
        ))}
      </div>
      <span className={cn('text-xs font-medium', strength.textClass)}>{strength.label}</span>
    </div>
  )
}

/**
 * Campo de contraseña con botón "Mostrar/Ocultar" (👁, mismo patrón ya
 * usado en `LoginForm.tsx` — no existía como componente reutilizable, se
 * extrae aquí como helper LOCAL de este archivo, no como un componente
 * nuevo del Design System, ya que sus 4 usos (Contraseña/Confirmar
 * contraseña/Nueva contraseña/Confirmar nueva contraseña) viven todos en
 * `UserForm.tsx`). Cada instancia controla su propia visibilidad de forma
 * independiente (`useState` propio, no compartido entre campos).
 *
 * `onGenerate` (opcional, solo en el campo de contraseña PRINCIPAL — no
 * en los de "Confirmar…"): botón adicional junto al de mostrar/ocultar
 * que dispara la generación de una contraseña aleatoria; quien la recibe
 * (`UserForm`) decide dónde colocarla (contraseña + confirmación).
 * `strengthValue` (opcional, mismo criterio): valor actual tipeado, para
 * mostrar `PasswordStrengthMeter` debajo del input — los campos de
 * confirmación no lo reciben, no tiene sentido medir "fortaleza" de una
 * copia.
 */
function PasswordField({
  id,
  label,
  required,
  disabled,
  ariaInvalid,
  error,
  inputProps,
  onGenerate,
  strengthValue,
}: {
  id: string
  label: string
  required?: boolean
  disabled?: boolean
  ariaInvalid?: boolean
  error?: string
  inputProps: InputHTMLAttributes<HTMLInputElement>
  onGenerate?: () => void
  strengthValue?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn('pr-9', onGenerate && 'pr-16')}
          {...inputProps}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-1">
          {onGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={disabled}
              tabIndex={-1}
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              aria-label="Generar contraseña segura"
              title="Generar contraseña segura"
            >
              <Wand2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            tabIndex={-1}
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {strengthValue !== undefined && <PasswordStrengthMeter password={strengthValue} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

/**
 * features/users/components/UserForm.tsx
 * -----------------------------------------------------------------------------
 * Estandar visual de formularios del sistema (ver `ProductForm.tsx`):
 * "Información personal" (nombre completo, usuario, correo), "Acceso"
 * (rol, contraseña) y "Opciones" (usuario activo, solo en creacion).
 * Ningun `name`, `register` ni validacion cambio de comportamiento.
 *
 * Canvas Workspace Usuarios (aprobado): el formulario pasa a dibujar su
 * propia superficie (`rounded-2xl border bg-card shadow-sm`) y un pie de
 * acciones como franja `border-t` — mismo patrón exacto que
 * `EditPurchaseForm.tsx` (la referencia de Compras). `CreateUserPage.tsx`/
 * `EditUserPage.tsx` no necesitan ningún cambio: ya renderizan este
 * componente directo bajo su `PageHeader`, así que ambos heredan el
 * Workspace automáticamente — "Crear y Editar reutilizan exactamente el
 * mismo Canvas Workspace" porque literalmente comparten este componente.
 *
 * Contraseñas (aprobado): cada campo de contraseña (Contraseña/Confirmar
 * contraseña en creación; Nueva contraseña/Confirmar nueva contraseña al
 * cambiarla en edición) tiene su propio botón mostrar/ocultar
 * (`PasswordField`, arriba). Los campos "Confirmar…" son deliberadamente
 * LOCALES (`useState`, no `register`d contra el schema): comparan contra
 * el valor real de `password` (`useWatch`) y bloquean el submit con un
 * mensaje local si no coinciden — sin tocar `user.schema.ts` ni el DTO
 * enviado al backend (nunca se envía un campo "confirmPassword"), tal
 * como fue pedido explícitamente ("no modificar validaciones, lógica ni
 * esquemas").
 *
 * En edición (aprobado, "no mostrar la contraseña por defecto"): el campo
 * de contraseña arranca OCULTO detrás de una acción "Cambiar contraseña"
 * — mientras no se pulsa, el campo `password` ni siquiera se registra en
 * el formulario (no se renderiza), así que el submit nunca envía un valor
 * vacío/sin cambios; solo al hacer click aparecen "Nueva contraseña" +
 * "Confirmar nueva contraseña". Mismo `name="password"` de siempre — el
 * DTO enviado al backend no cambia de forma.
 */
export function UserForm({
  mode,
  defaultValues,
  roles,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    unregister,
    formState: { errors },
  } = useForm<CreateUserDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo abstracto
    // `z.ZodType<CreateUserDto | UpdateUserDto>` que exponen los schemas de
    // user.schema.ts (no se modifica ese archivo desde aqui). El cast a
    // `never` en el argumento evita el choque de overloads; el resultado se
    // castea a `Resolver<CreateUserDto>` porque ambos schemas validan el
    // mismo conjunto de campos (salvo `active`), compatible con este form.
    resolver: zodResolver(
      (mode === 'create' ? createUserSchema : updateUserSchema) as never,
    ) as unknown as Resolver<CreateUserDto>,
    defaultValues,
  })

  const submitLabel = isSubmitting ? 'Guardando...' : 'Guardar'
  const selectedRoleId = useWatch({ control, name: 'roleId' })
  const selectedRole = roles.find((role) => role.id === selectedRoleId)
  const passwordValue = useWatch({ control, name: 'password' })

  // Confirmar contraseña (creación) — puramente local, ver comentario de
  // archivo arriba.
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)
  const createMismatch =
    mode === 'create' && confirmPasswordTouched && confirmPassword !== (passwordValue ?? '')

  // Cambiar contraseña (edición) — colapsado por defecto, ver comentario
  // de archivo arriba.
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [confirmNewPasswordTouched, setConfirmNewPasswordTouched] = useState(false)
  const updateMismatch =
    mode === 'update' &&
    isChangingPassword &&
    confirmNewPasswordTouched &&
    confirmNewPassword !== (passwordValue ?? '')

  const submit = handleSubmit((values) => {
    if (mode === 'create' && values.password !== confirmPassword) {
      setConfirmPasswordTouched(true)
      return
    }
    if (mode === 'update' && isChangingPassword && values.password !== confirmNewPassword) {
      setConfirmNewPasswordTouched(true)
      return
    }
    onSubmit(values)
  })

  // Generador de contraseña segura (aprobado, "reutilizar exactamente el
  // mismo flujo existente del formulario"): escribe el valor generado en
  // el mismo campo `password` registrado (`setValue`, con validación/
  // dirty igual que si el usuario lo hubiera tipeado) y en el campo
  // "Confirmar…" local correspondiente — mismo mecanismo de coincidencia
  // ya existente, sin ningún camino de envío nuevo.
  const handleGenerateCreatePassword = () => {
    const generated = generateSecurePassword()
    setValue('password', generated, { shouldValidate: true, shouldDirty: true })
    setConfirmPassword(generated)
    setConfirmPasswordTouched(true)
  }

  const handleGenerateNewPassword = () => {
    const generated = generateSecurePassword()
    setValue('password', generated, { shouldValidate: true, shouldDirty: true })
    setConfirmNewPassword(generated)
    setConfirmNewPasswordTouched(true)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <FormSection icon={User} title="Información personal">
            <div className="flex flex-col gap-1">
              <Label htmlFor="user-form-fullName">
                Nombre completo
                <RequiredMark />
              </Label>
              <Input
                id="user-form-fullName"
                disabled={isSubmitting}
                aria-invalid={!!errors.fullName}
                {...register('fullName')}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="user-form-username">
                Usuario
                <RequiredMark />
              </Label>
              <Input
                id="user-form-username"
                disabled={isSubmitting}
                aria-invalid={!!errors.username}
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="user-form-email">Correo</Label>
              <Input
                id="user-form-email"
                type="email"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </FormSection>

          <FormSection icon={KeyRound} title="Acceso">
            <div className="flex flex-col gap-1">
              <Label htmlFor="user-form-roleId">
                Rol
                <RequiredMark />
              </Label>
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(value: unknown) => field.onChange(value as string)}
                  >
                    <SelectTrigger
                      id="user-form-roleId"
                      disabled={isSubmitting}
                      aria-invalid={!!errors.roleId}
                    >
                      {/*
                        @base-ui/react Select.Value no deriva el label de los
                        Select.Item renderizados. Se resuelve manualmente
                        buscando en `roles`.
                      */}
                      <SelectValue>
                        {(value: unknown) => {
                          const roleId = value as string
                          if (!roleId) return 'Selecciona un rol'
                          return (
                            roles.find((role) => role.id === roleId)?.name ??
                            roleId
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.roleId && (
                <p className="text-sm text-destructive">{errors.roleId.message}</p>
              )}
            </div>

            {selectedRole?.permissions && (
              <div className="rounded-xl border border-dashed border-brand/30 bg-brand/5 p-3">
                <RolePermissionsPreview permissions={selectedRole.permissions} />
              </div>
            )}

            {mode === 'create' && (
              <>
                <PasswordField
                  id="user-form-password"
                  label="Contraseña"
                  required
                  disabled={isSubmitting}
                  ariaInvalid={!!errors.password}
                  error={errors.password?.message}
                  inputProps={register('password')}
                  onGenerate={handleGenerateCreatePassword}
                  strengthValue={passwordValue ?? ''}
                />
                <PasswordField
                  id="user-form-confirmPassword"
                  label="Confirmar contraseña"
                  required
                  disabled={isSubmitting}
                  ariaInvalid={createMismatch}
                  error={createMismatch ? 'Las contraseñas no coinciden.' : undefined}
                  inputProps={{
                    value: confirmPassword,
                    onChange: (event) => setConfirmPassword(event.target.value),
                    onBlur: () => setConfirmPasswordTouched(true),
                    autoComplete: 'new-password',
                  }}
                />
              </>
            )}

            {mode === 'update' && !isChangingPassword && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsChangingPassword(true)}
                className="w-fit gap-2 rounded-xl"
              >
                <KeyRound className="size-4" />
                Cambiar contraseña
              </Button>
            )}

            {mode === 'update' && isChangingPassword && (
              <>
                <PasswordField
                  id="user-form-password"
                  label="Nueva contraseña"
                  required
                  disabled={isSubmitting}
                  ariaInvalid={!!errors.password}
                  error={errors.password?.message}
                  inputProps={{ ...register('password'), autoComplete: 'new-password' }}
                  onGenerate={handleGenerateNewPassword}
                  strengthValue={passwordValue ?? ''}
                />
                <PasswordField
                  id="user-form-confirmPassword"
                  label="Confirmar nueva contraseña"
                  required
                  disabled={isSubmitting}
                  ariaInvalid={updateMismatch}
                  error={updateMismatch ? 'Las contraseñas no coinciden.' : undefined}
                  inputProps={{
                    value: confirmNewPassword,
                    onChange: (event) => setConfirmNewPassword(event.target.value),
                    onBlur: () => setConfirmNewPasswordTouched(true),
                    autoComplete: 'new-password',
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => {
                    unregister('password')
                    setConfirmNewPassword('')
                    setConfirmNewPasswordTouched(false)
                    setIsChangingPassword(false)
                  }}
                  className="w-fit gap-2 rounded-xl"
                >
                  Cancelar cambio de contraseña
                </Button>
              </>
            )}
          </FormSection>
        </div>

        {mode === 'create' && (
          <div className="px-5 pb-5">
            <FormSection icon={SlidersHorizontal} title="Opciones">
              <div className="flex items-center gap-2">
                <input
                  id="user-form-active"
                  type="checkbox"
                  disabled={isSubmitting}
                  className={cn(
                    'size-4 rounded border-input',
                    'focus-visible:ring-3 focus-visible:ring-ring/50',
                  )}
                  {...register('active')}
                />
                <Label htmlFor="user-form-active">Usuario activo</Label>
              </div>
            </FormSection>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border px-5 py-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
