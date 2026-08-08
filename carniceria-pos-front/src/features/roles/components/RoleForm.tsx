import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, ChevronRight, Shield } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { cn } from '@/lib/utils'
import { RolePermissionSelector } from './RolePermissionSelector'
import { createRoleSchema } from '../schemas/role.schema'
import type { CreateRoleDto } from '../types/role.types'

interface Permission {
  id: string
  code: string
  description: string | null
}

interface RoleFormProps {
  defaultValues?: Partial<CreateRoleDto>
  onSubmit: (values: CreateRoleDto) => void
  loading?: boolean
  /** Bloque Roles (rediseño, aprobado): catálogo completo de permisos para
   * la sección colapsable "Permisos" — opcional y aditivo, solo
   * `CreateRolePage.tsx` la pasa. `EditRolePage.tsx` no la pasa (los
   * permisos de un rol existente se administran en su propia sección,
   * `RolePermissionsSection`, con su propio endpoint
   * `PATCH /roles/:id/permissions` — `UpdateRoleDto` no acepta
   * `permissionIds`), así que sin este prop el formulario se comporta
   * exactamente igual que antes. */
  permissions?: Permission[]
  /**
   * QA.11 (Roles): deshabilita el campo Nombre — usado por
   * `EditRolePage.tsx` cuando el rol es de sistema (`role.isSystem`). El
   * backend ya rechaza renombrar un rol de sistema
   * (`roles.service.ts::update`, mismo criterio que ya bloquea
   * desactivarlo) — este prop solo evita que el usuario escriba un
   * nombre nuevo para terminar viendo ese error recien al guardar.
   * `undefined`/`false` en creación (nunca aplica: un rol nuevo no puede
   * ser de sistema, `isSystem` no es escribible desde el cliente).
   */
  nameDisabled?: boolean
}

const textareaClassName =
  'flex min-h-16 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * features/roles/components/RoleForm.tsx
 * -----------------------------------------------------------------------------
 * Estandar visual de formularios del sistema (ver `ProductForm.tsx`): una
 * sola `FormSection` ("Información general"), porque el formulario solo
 * tiene 2 campos — no tiene sentido fragmentar algo tan chico en varias
 * tarjetas. Ningun `name`, `register` ni validacion cambio de
 * comportamiento (sigue sin `onCancel`, sigue usando `loading` en vez de
 * `isSubmitting` — mismos props que antes).
 */
export function RoleForm({
  defaultValues,
  onSubmit,
  loading = false,
  permissions,
  nameDisabled = false,
}: RoleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRoleDto>({
    // Se usa siempre `createRoleSchema` (no hay una prop `mode` en este
    // formulario): sus reglas son un superconjunto de `updateRoleSchema`
    // (mismos campos, `name` requerido en ambos casos tiene sentido tanto
    // al crear como al editar un rol), asi que sirve para los dos flujos
    // sin necesidad de alternar el resolver.
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CreateRoleDto>` que expone role.schema.ts (no se
    // modifica ese archivo desde aqui). Mismo cast usado en UserForm.tsx
    // por el mismo motivo.
    resolver: zodResolver(createRoleSchema as never) as unknown as Resolver<CreateRoleDto>,
    defaultValues,
  })

  // Bloque Roles (rediseño, aprobado): sección colapsable "Permisos",
  // inicia cerrada (mismo criterio ya aplicado a las secciones agrupadas
  // del Bloque Permisos). Solo existe cuando `permissions` fue provisto
  // (ver comentario de la prop) — `EditRolePage.tsx` no la pasa, así que
  // este estado nunca se monta ahí.
  const [permissionsExpanded, setPermissionsExpanded] = useState(false)
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(
    defaultValues?.permissionIds ?? [],
  )

  const submit = handleSubmit((values) =>
    onSubmit(permissions ? { ...values, permissionIds: selectedPermissionIds } : values),
  )

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormSection icon={Shield} title="Información general">
        <div className="flex flex-col gap-1">
          <Label htmlFor="role-form-name">
            Nombre
            <RequiredMark />
          </Label>
          <Input
            id="role-form-name"
            disabled={loading || nameDisabled}
            aria-invalid={!!errors.name}
            title={nameDisabled ? 'No se puede renombrar un rol de sistema.' : undefined}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
          {nameDisabled && (
            <p className="text-xs text-muted-foreground">
              Este es un rol de sistema — su nombre no se puede cambiar.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="role-form-description">Descripción</Label>
          <textarea
            id="role-form-description"
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

        {/*
          No se incluye un campo para "Rol del sistema" (isSystem): ni
          CreateRoleDto ni UpdateRoleDto (role.types.ts / backend) exponen esa
          propiedad como escribible. `isSystem` es un valor que solo devuelve
          el backend en `Role`, no algo que el cliente pueda establecer.
        */}
      </FormSection>

      {permissions && (
        <FormSection
          icon={Shield}
          title="Permisos"
          description="Selecciona los permisos que tendrá este rol (opcional)."
          headerAction={
            <div className="flex items-center gap-2">
              {selectedPermissionIds.length > 0 && (
                <Badge variant="accent">{selectedPermissionIds.length} seleccionados</Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPermissionsExpanded((current) => !current)}
                className="h-auto gap-1 p-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
              >
                {permissionsExpanded ? (
                  <>
                    Ocultar <ChevronDown className="size-3.5" />
                  </>
                ) : (
                  <>
                    Mostrar <ChevronRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          }
        >
          {permissionsExpanded ? (
            <RolePermissionSelector
              permissions={permissions}
              selectedPermissionIds={selectedPermissionIds}
              onChange={setSelectedPermissionIds}
              disabled={loading}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              El selector de permisos está oculto — usá "Mostrar" para elegirlos.
            </p>
          )}
        </FormSection>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
