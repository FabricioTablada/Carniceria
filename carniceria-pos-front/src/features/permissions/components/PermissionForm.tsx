import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { cn } from '@/lib/utils'
import { createPermissionSchema } from '../schemas/permission.schema'
import type { CreatePermissionDto } from '../types/permission.types'

interface PermissionFormProps {
  defaultValues?: Partial<CreatePermissionDto>
  onSubmit: (values: CreatePermissionDto) => void
  loading?: boolean
  /**
   * QA.12 (Permisos): deshabilita el campo Código — usado por
   * `EditPermissionPage.tsx`. El backend ya rechaza modificar el `code` de
   * un permiso ya creado (`permissions.service.ts::update`, es código
   * literal referenciado por decenas de llamadas
   * `authorizePermission('modulo.accion')` en todo el backend) — este prop
   * solo evita que el usuario lo edite para terminar viendo ese error
   * recién al guardar. `undefined`/`false` en creación (el código de un
   * permiso nuevo sigue siendo libremente editable hasta guardarlo).
   */
  codeDisabled?: boolean
}

const textareaClassName =
  'flex min-h-16 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * features/permissions/components/PermissionForm.tsx
 * -----------------------------------------------------------------------------
 * Estandar visual de formularios del sistema (ver `ProductForm.tsx`): una
 * sola `FormSection` ("Información general"), mismo criterio que
 * `RoleForm.tsx` — 2 campos no ameritan varias tarjetas. Ningun `name`,
 * `register` ni validacion cambio de comportamiento (sigue sin
 * `onCancel`, sigue usando `loading`).
 */
export function PermissionForm({
  defaultValues,
  onSubmit,
  loading = false,
  codeDisabled = false,
}: PermissionFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePermissionDto>({
    resolver: zodResolver(createPermissionSchema as never) as unknown as Resolver<CreatePermissionDto>,
    defaultValues,
  })

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormSection icon={KeyRound} title="Información general">
        <div className="flex flex-col gap-1">
          <Label htmlFor="permission-form-code">
            Código
            <RequiredMark />
          </Label>
          <Input
            id="permission-form-code"
            disabled={loading || codeDisabled}
            aria-invalid={!!errors.code}
            title={codeDisabled ? 'El código de un permiso no se puede modificar después de creado.' : undefined}
            {...register('code')}
          />
          {errors.code && (
            <p className="text-sm text-destructive">{errors.code.message}</p>
          )}
          {codeDisabled && (
            <p className="text-xs text-muted-foreground">
              El código no se puede cambiar una vez creado el permiso.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="permission-form-description">Descripción</Label>
          <textarea
            id="permission-form-description"
            disabled={loading}
            aria-invalid={!!errors.description}
            className={cn(textareaClassName)}
            {...register('description')}
          />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
