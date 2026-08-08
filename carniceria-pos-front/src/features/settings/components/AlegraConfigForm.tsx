import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plug, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { AlegraStatusBadge } from './AlegraStatusBadge'
import { saveAlegraConfigSchema, testAlegraConnectionSchema } from '../schemas/alegra.schema'
import type {
  AlegraConfigStatus,
  AlegraConnectionTestResult,
  AlegraTestConnectionDto,
  SaveAlegraConfigDto,
} from '../types/alegra.types'

/** Bloque 7.4, punto 2: precargado por defecto — editable solo para
 * pruebas avanzadas (ambiente sandbox, proxy de pruebas, etc.). Mismo
 * valor que `ALEGRA_DEFAULT_BASE_URL` en el backend
 * (`modules/integrations/alegra/alegra.client.ts`); se repite aquí como
 * literal porque es un valor de precarga de UI, no algo que el backend
 * exponga por un endpoint propio. */
const ALEGRA_DEFAULT_BASE_URL = 'https://api.alegra.com/api/v1/'

interface AlegraConfigFormProps {
  status?: AlegraConfigStatus
  isSaving: boolean
  isTesting: boolean
  testResult?: AlegraConnectionTestResult
  testErrorMessage?: string
  onSave: (values: SaveAlegraConfigDto) => void
  onTestConnection: (values: AlegraTestConnectionDto) => void
}

/**
 * features/settings/components/AlegraConfigForm.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.4. Un único `useForm<SaveAlegraConfigDto>` (mismo criterio que
 * `ConfigurationForm.tsx`), pero con DOS acciones que exigen validaciones
 * distintas sobre el mismo campo `token`:
 *  - "Guardar" pasa por `handleSubmit` con el resolver de
 *    `saveAlegraConfigSchema` (token opcional — vacío conserva el
 *    guardado).
 *  - "Probar conexión" NO usa `handleSubmit` (evitaría poder probar sin
 *    guardar): valida manualmente con `testAlegraConnectionSchema`
 *    (token obligatorio) contra `getValues()`, y solo entonces llama a
 *    `onTestConnection`.
 *
 * El token nunca se precarga en el input (punto 6: "no debe mostrarse en
 * texto plano al volver a abrir la pantalla") — cuando ya hay
 * configuración guardada, el campo queda vacío con un placeholder
 * enmascarado (`status.maskedToken`) y un texto de ayuda explicando que
 * dejarlo así conserva el valor actual.
 */
export function AlegraConfigForm({
  status,
  isSaving,
  isTesting,
  testResult,
  testErrorMessage,
  onSave,
  onTestConnection,
}: AlegraConfigFormProps) {
  const [testValidationError, setTestValidationError] = useState<string | null>(null)

  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors },
  } = useForm<SaveAlegraConfigDto>({
    resolver: zodResolver(saveAlegraConfigSchema as never) as unknown as Resolver<SaveAlegraConfigDto>,
    values: {
      email: status?.email ?? '',
      token: '',
      baseUrl: status?.baseUrl ?? ALEGRA_DEFAULT_BASE_URL,
    },
  })

  const submitSave = handleSubmit((values) => onSave(values))

  const handleTestConnection = () => {
    const parsed = testAlegraConnectionSchema.safeParse(getValues())

    if (!parsed.success) {
      setTestValidationError(
        parsed.error.issues[0]?.message ?? 'Completa los campos obligatorios para probar la conexión.',
      )
      return
    }

    setTestValidationError(null)
    onTestConnection(parsed.data)
  }

  return (
    <form onSubmit={submitSave} noValidate className="flex flex-col gap-4">
      <FormSection
        icon={Receipt}
        title="Credenciales de Alegra"
        description="Correo y token de API de tu cuenta de Alegra."
        headerAction={<AlegraStatusBadge configured={status?.configured ?? false} />}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="alegra-form-email">
            Correo de Alegra
            <RequiredMark />
          </Label>
          <Input
            id="alegra-form-email"
            type="email"
            autoComplete="off"
            disabled={isSaving}
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="alegra-form-token">
            Token de API
            {!status?.configured && <RequiredMark />}
          </Label>
          <Input
            id="alegra-form-token"
            type="password"
            autoComplete="off"
            placeholder={status?.maskedToken ?? undefined}
            disabled={isSaving}
            aria-invalid={!!errors.token}
            {...register('token')}
          />
          {status?.configured && (
            <p className="text-sm text-muted-foreground">
              Déjalo en blanco para conservar el token ya guardado.
            </p>
          )}
          {errors.token && <p className="text-sm text-destructive">{errors.token.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="alegra-form-base-url">
            URL Base
            <RequiredMark />
          </Label>
          <Input
            id="alegra-form-base-url"
            autoComplete="off"
            disabled={isSaving}
            aria-invalid={!!errors.baseUrl}
            {...register('baseUrl')}
          />
          <p className="text-sm text-muted-foreground">
            Editable solo para pruebas avanzadas — el valor por defecto es correcto para el uso normal.
          </p>
          {errors.baseUrl && <p className="text-sm text-destructive">{errors.baseUrl.message}</p>}
        </div>

        {testValidationError && <ErrorAlert>{testValidationError}</ErrorAlert>}

        {testErrorMessage && <ErrorAlert>{testErrorMessage}</ErrorAlert>}

        {testResult && (
          <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm text-secondary-foreground">
            Conexión exitosa
            {testResult.company.name ? ` — ${testResult.company.name}` : ''}
            {testResult.company.identification ? ` (${testResult.company.identification})` : ''}.
          </div>
        )}
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isTesting || isSaving}
          onClick={handleTestConnection}
          className="gap-2"
        >
          <Plug className="size-4" />
          {isTesting ? 'Probando...' : 'Probar conexión'}
        </Button>
        <Button type="submit" disabled={isSaving || isTesting}>
          {isSaving ? 'Guardando...' : 'Guardar configuración'}
        </Button>
      </div>
    </form>
  )
}
