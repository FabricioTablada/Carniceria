import type { BaseSyntheticEvent } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FolderTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { resolveCategoryColor } from '@/lib/categoryColor'
import {
  createCategorySchema,
  updateCategorySchema,
} from '../schemas/category.schema'
import { CategoryStatusBadge } from './CategoryStatusBadge'
import type { CreateCategoryDto } from '../types/category.types'

interface SelectOption {
  id: string
  name: string
}

interface CategoryFormProps {
  /** Determina que schema de validacion se usa y que campos se muestran. */
  mode: 'create' | 'update'
  /** Valores iniciales del formulario (por ejemplo, al editar una categoria). */
  defaultValues?: Partial<CreateCategoryDto>
  /** Opciones para el selector de categoria padre. */
  categories: SelectOption[]
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CreateCategoryDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** Solo en modo edicion — id de la categoria real. Se mantiene por
   * compatibilidad de la interfaz publica (`EditCategoryPage.tsx` lo
   * sigue pasando); ya no se usa para resolver color (ver
   * `resolveCategoryColor` mas abajo, resuelve por el `color` observado
   * directamente). */
  categoryId?: string
  /** Solo en modo edicion — `UpdateCategoryDto` no incluye `active` (el
   * backend lo maneja aparte, ver `category.schema.ts`), asi que el
   * formulario no lo observa por `watch()` en este modo; se muestra el
   * valor ya conocido de la categoria. Mismo criterio que
   * `ProductForm.tsx`/`initialActive`. */
  initialActive?: boolean
}

const textareaClassName =
  'flex min-h-16 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** Valor de reposo del control nativo `<input type="color">` — el widget
 * del navegador EXIGE un hex de 6 digitos como valor, no puede quedar
 * vacio/indefinido. Es puramente el estado visual del selector mientras
 * no se eligio nada (nunca se guarda: el campo real del formulario sigue
 * en `null` hasta que el usuario efectivamente cambia el color) — no es
 * un color hardcodeado de UI, es una limitacion del elemento nativo. La
 * vista previa REAL (el icono de la banda de identidad, mas abajo) usa
 * `resolveCategoryColor`, que si refleja fielmente "sin color propio". */
const COLOR_INPUT_REST_VALUE = '#94A3B8'

/**
 * features/categories/components/CategoryForm.tsx
 * -----------------------------------------------------------------------------
 * "Canvas Workspace" (aprobado, mismo lenguaje visual que
 * `ProductForm.tsx`): una única superficie (`rounded-2xl border bg-card
 * shadow-sm`), sin tarjeta lateral — el panel de Resumen
 * (`CategoryFormSummary.tsx`) se ELIMINÓ, cada dato que mostraba
 * encontró un lugar dentro de la misma superficie:
 *  - Banda de identidad (arriba): icono con vista previa de color en
 *    tiempo real + Nombre + Estado (Switch en creación, badge de solo
 *    lectura en edición) — misma idea que el Hero de `ProductForm.tsx`,
 *    proporcional al tamaño real de este formulario (sin imagen/precio
 *    que mostrar).
 *  - Cuerpo: Color de la categoría (inmediatamente debajo de "Nombre",
 *    pedido explícito de este bloque) → Descripción → Categoría padre.
 *
 * Sin grilla de 3 columnas tipo Productos: forzarla con solo 3 campos
 * sería relleno artificial (mismo criterio que ya documentaba este
 * archivo antes de este bloque) — "aprovechar mejor el ancho" acá se
 * logra con la banda de identidad a lo ancho completo y un cuerpo de una
 * sola columna sin desperdiciar alto en secciones vacías.
 *
 * "Categoría activa" reutiliza el mismo `Switch` de `ProductForm.tsx`
 * (antes: checkbox nativo dentro de una `FormSection` propia solo para
 * eso) — ya no vive en una tarjeta independiente, es parte de la banda
 * de identidad.
 *
 * Color (Bloque "Color de categoría"): campo nuevo `color` (hex,
 * `Category.color` en el backend), registrado via `Controller` (dos
 * controles atados al mismo valor: el swatch nativo y el input de texto
 * hex). `null`/`undefined` = sin color propio — el badge/icono en TODO
 * el ERP sigue resolviendo el mismo color determinístico de siempre
 * (`resolveCategoryColor`, `lib/categoryColor.ts`), cero cambio visual
 * para categorias que nunca se editan despues de este bloque.
 */
export function CategoryForm({
  mode,
  defaultValues,
  categories,
  isSubmitting = false,
  onSubmit,
  onCancel,
  initialActive,
}: CategoryFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCategoryDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CreateCategoryDto | UpdateCategoryDto>` que
    // exponen los schemas de category.schema.ts (no se modifica ese
    // archivo desde aqui). Mismo cast usado en ProductForm.tsx/UserForm.tsx
    // por el mismo motivo.
    resolver: zodResolver(
      (mode === 'create' ? createCategorySchema : updateCategorySchema) as never,
    ) as unknown as Resolver<CreateCategoryDto>,
    defaultValues,
  })

  const handleFormSubmit = handleSubmit((values) => onSubmit(values))

  // Igual que `ProductForm.tsx`: este formulario se usa tanto en paginas
  // propias (CreateCategoryPage/EditCategoryPage, sin ningun `<form>`
  // ancestro) como embebido dentro de `CategorySearchDialog.tsx`, que a su
  // vez puede vivir dentro de `ProductCategoryField.tsx` -> `QuickProductForm.tsx`
  // -> `ProductSearchDialog.tsx` -> `PurchaseForm.tsx`. El dialogo usa un
  // `Portal`, asi que los `<form>` no quedan anidados en el DOM real, pero
  // React sigue tratando el `submit` como si burbujeara por el arbol de
  // componentes. Sin este `stopPropagation`, guardar una categoria nueva
  // tambien dispararia el submit de cualquier formulario ancestro. No-op
  // inofensivo en el caso normal (paginas propias, sin ancestro).
  const submit = (event?: BaseSyntheticEvent) => {
    event?.stopPropagation()
    return handleFormSubmit(event)
  }

  const watchedColor = useWatch({ control, name: 'color' })

  const previewColor = resolveCategoryColor({ id: 'category-form-preview', color: watchedColor })

  return (
    <form onSubmit={submit} noValidate className="@container/category-form flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        {/* Banda de identidad — ver doc del componente arriba. */}
        <div className="flex flex-col gap-4 border-b border-border p-5 @lg/category-form:flex-row @lg/category-form:items-center">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-xl"
            style={{ ...previewColor.tint, ...previewColor.text }}
          >
            <FolderTree className="size-6" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="category-form-name">
              Nombre
              <RequiredMark />
            </Label>
            <Input
              id="category-form-name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              className="h-10 text-lg font-semibold"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5 self-start rounded-lg border border-input bg-card px-3.5 py-2.5 @lg/category-form:self-auto">
            {mode === 'create' ? (
              <>
                <Label htmlFor="category-form-active" className="text-sm">
                  Categoría activa
                </Label>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Switch
                      id="category-form-active"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Estado</span>
                <CategoryStatusBadge active={initialActive ?? false} />
              </>
            )}
          </div>
        </div>

        {/* Cuerpo — Color inmediatamente debajo de "Nombre", luego
            Descripción y Categoría padre. */}
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-form-color">Color de la categoría</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <input
                    id="category-form-color"
                    type="color"
                    value={field.value ?? COLOR_INPUT_REST_VALUE}
                    onChange={(event) => field.onChange(event.target.value)}
                    disabled={isSubmitting}
                    className="size-10 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5 disabled:pointer-events-none disabled:opacity-50 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  <Input
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value || null)}
                    placeholder="Automático"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.color}
                    className="w-32 font-mono uppercase"
                    maxLength={7}
                  />
                  {field.value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => field.onChange(null)}
                    >
                      Usar color automático
                    </Button>
                  )}
                </div>
              )}
            />
            {errors.color ? (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Se usa en toda la app (listados, etiquetas, Drawer). Si no elegís uno, el
                sistema asigna un color automático y consistente.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="category-form-description">Descripción</Label>
            <textarea
              id="category-form-description"
              disabled={isSubmitting}
              aria-invalid={!!errors.description}
              className={textareaClassName}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="category-form-parentId">Categoría padre</Label>
            <Controller
              control={control}
              name="parentId"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(value: unknown) => {
                    const parentId = value as string

                    // Mismo criterio que antes con `setValueAs` en register:
                    // "" ("Sin categoria padre") se transforma a undefined
                    // ANTES de que Zod lo valide, para no chocar con `.uuid()`
                    // en createCategorySchema/updateCategorySchema (no se
                    // modifica ese archivo desde aqui).
                    field.onChange(parentId === '' ? undefined : parentId)
                  }}
                >
                  <SelectTrigger
                    id="category-form-parentId"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.parentId}
                  >
                    {/*
                      @base-ui/react Select.Value no deriva el label de los
                      Select.Item renderizados: sin esta funcion, mostraba el
                      uuid crudo de la categoria padre en vez de su nombre.
                    */}
                    <SelectValue>
                      {(value: unknown) => {
                        const parentId = value as string
                        if (!parentId) return 'Sin categoría padre'
                        return (
                          categories.find((category) => category.id === parentId)?.name ??
                          parentId
                        )
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin categoría padre</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.parentId && (
              <p className="text-sm text-destructive">{errors.parentId.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border px-5 py-3">
          {onCancel && (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>
  )
}
