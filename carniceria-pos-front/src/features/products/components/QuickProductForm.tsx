import { useState, type BaseSyntheticEvent } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight } from 'lucide-react'
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
import { createProductSchema } from '../schemas/product.schema'
import { ProductCategoryField } from './ProductCategoryField'
import { ProductTaxField } from './ProductTaxField'
import type { CreateProductDto } from '../types/product.types'

interface SelectOption {
  id: string
  name: string
}

interface QuickProductFormProps {
  /** Opciones para el selector de impuesto. */
  taxes: SelectOption[]
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CreateProductDto) => void
}

const checkboxClassName = cn(
  'size-4 rounded border-input',
  'focus-visible:ring-3 focus-visible:ring-ring/50',
)

const textareaClassName =
  'flex min-h-16 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const UNIT_LABELS: Record<string, string> = {
  UNIT: 'Unidad',
  KILOGRAM: 'Kilogramo',
}

/** id del `<form>` — `ProductSearchDialog.tsx` referencia este mismo
 * literal en el atributo `form` de su boton "Guardar" (fuera del `<form>`,
 * en el footer fijo del dialogo). No se centraliza en una constante
 * exportada porque este archivo solo exporta un componente (ver
 * `react-refresh/only-export-components`, ya aplicado en el resto del
 * proyecto) — mismo criterio que los ids hardcodeados de `ProductForm.tsx`
 * (`product-form-name`, etc.). */
const FORM_ID = 'quick-product-form'

/**
 * features/products/components/QuickProductForm.tsx
 * -----------------------------------------------------------------------------
 * Version optimizada para velocidad de `ProductForm.tsx`, usada
 * unicamente por `ProductSearchDialog.tsx` (crear un producto sin
 * abandonar una compra). Siempre en modo creacion — no existe una
 * variante de edicion de este formulario, por eso no recibe `mode` ni
 * `defaultValues` como `ProductForm`.
 *
 * Reutiliza, sin duplicar ninguna regla: `createProductSchema` +
 * `zodResolver` (mismo schema que `ProductForm`, no una version relajada
 * — los campos "avanzados" siguen siendo opcionales porque el schema ya
 * los marca `.optional()`/`.nullish()`, no porque este formulario invente
 * una excepcion), `CreateProductDto`, y los mismos `ProductCategoryField`/
 * `ProductTaxField` que usa `ProductForm` (el buscador de categoria y el
 * Select de impuesto no se redefinen aca).
 *
 * Campos siempre visibles: exactamente los que `createProductSchema`
 * marca como obligatorios (nombre, categoria, impuesto, precio de venta,
 * costo, código CABYS — Bloque 7.12) — la frontera "rapido vs. avanzado" se deriva de esa regla de
 * negocio ya existente, no de una opinion de UX aparte. Todo lo demas
 * (SKU, codigo de barras, descripcion, unidad de medida, peso variable,
 * controlar inventario, activo) vive detras de un disclosure cerrado por
 * defecto ("Opciones avanzadas"). Como esos campos quedan ocultos, se les
 * da un `defaultValue` explicito y razonable (unidad "Unidad", activo y
 * con inventario controlado) en vez de depender del estado sin marcar de
 * un checkbox que el usuario nunca vio.
 *
 * Sin `Card`/`FormSection`: a proposito, para que este formulario no se
 * sienta como una pagina de administracion incrustada en un modal — ese
 * fue exactamente el problema reportado en QA con la version anterior
 * (`ProductForm` completo dentro de `ProductSearchDialog`).
 *
 * El footer (Cancelar/Guardar) NO vive dentro de este componente — lo
 * renderiza `ProductSearchDialog.tsx` en una franja fija fuera del area
 * con scroll, y el boton "Guardar" dispara el envio de este `<form>` via
 * el atributo HTML `form="quick-product-form"` (`FORM_ID` arriba), sin
 * necesitar que el boton este dentro del `<form>`. Esto es lo que permite
 * que el footer quede siempre visible sin importar cuanto contenido este
 * expandido en "Opciones avanzadas".
 *
 * Alineación Design System V1: SKU/código de barras ahora usan `font-mono`
 * (mismo tratamiento que `ProductForm.tsx` para datos tabulares/códigos).
 * "Opciones avanzadas" pasó de mostrar/ocultar con un salto abrupto (mount/
 * unmount condicional) a una transición de altura suave (`grid-rows-[0fr]`
 * → `grid-rows-[1fr]`, truco CSS sin JS de medición) — los campos quedan
 * siempre montados (mismos `register`, ningún valor se pierde al colapsar,
 * igual que antes: RHF ya conservaba el valor de un campo desmontado) pero
 * inaccesibles por teclado/lectores de pantalla mientras está cerrado via
 * `inert`, en vez del `{isAdvancedOpen && (...)}` anterior.
 */
export function QuickProductForm({ taxes, isSubmitting = false, onSubmit }: QuickProductFormProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProductDto>({
    // Mismo cast que `ProductForm.tsx`/`CategoryForm.tsx`: `zodResolver` no
    // puede resolver sus overloads contra el tipo abstracto que expone
    // `product.schema.ts` (no se modifica ese archivo desde aqui).
    resolver: zodResolver(createProductSchema as never) as unknown as Resolver<CreateProductDto>,
    defaultValues: {
      unitOfMeasure: 'UNIT',
      trackInventory: true,
      isVariableWeight: false,
      active: true,
    },
  })

  const handleFormSubmit = handleSubmit((values) => onSubmit(values))

  // Mismo aislamiento que `ProductForm.tsx`/`CategoryForm.tsx`: este
  // formulario vive, en el arbol de React, dentro del `<form>` de
  // `PurchaseForm.tsx` (via `ProductSearchDialog.tsx`) — sin esto, guardar
  // un producto rapido tambien dispararia el submit de la compra en curso.
  const submit = (event?: BaseSyntheticEvent) => {
    event?.stopPropagation()
    return handleFormSubmit(event)
  }

  return (
    <form
      id={FORM_ID}
      onSubmit={submit}
      noValidate
      className="@container/quick-product flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="quick-product-name">
          Nombre
          <RequiredMark />
        </Label>
        <Input
          id="quick-product-name"
          autoFocus
          disabled={isSubmitting}
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 @sm/quick-product:grid-cols-2">
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <ProductCategoryField
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.categoryId?.message}
              disabled={isSubmitting}
            />
          )}
        />

        <ProductTaxField
          control={control}
          taxes={taxes}
          error={errors.taxId?.message}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 @sm/quick-product:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="quick-product-salePrice">
            Precio de venta
            <RequiredMark />
          </Label>
          <Input
            id="quick-product-salePrice"
            type="number"
            step="0.01"
            disabled={isSubmitting}
            aria-invalid={!!errors.salePrice}
            {...register('salePrice', { valueAsNumber: true })}
          />
          {errors.salePrice && (
            <p className="text-sm text-destructive">{errors.salePrice.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="quick-product-cost">
            Costo
            <RequiredMark />
          </Label>
          <Input
            id="quick-product-cost"
            type="number"
            step="0.01"
            disabled={isSubmitting}
            aria-invalid={!!errors.cost}
            {...register('cost', { valueAsNumber: true })}
          />
          {errors.cost && (
            <p className="text-sm text-destructive">{errors.cost.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="quick-product-cabysCode">
          Código CABYS
          <RequiredMark />
        </Label>
        <Input
          id="quick-product-cabysCode"
          placeholder="Ej. 0111100000000"
          disabled={isSubmitting}
          aria-invalid={!!errors.cabysCode}
          className="font-mono"
          {...register('cabysCode')}
        />
        {errors.cabysCode && (
          <p className="text-sm text-destructive">{errors.cabysCode.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-3.5 border-t pt-4">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen((current) => !current)}
          aria-expanded={isAdvancedOpen}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-brand"
        >
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200 ease-out',
              isAdvancedOpen && 'rotate-90',
            )}
          />
          Opciones avanzadas
        </button>

        <div
          className={cn(
            'grid transition-all duration-200 ease-out',
            isAdvancedOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3.5 pt-0.5" inert={!isAdvancedOpen}>
              <div className="grid grid-cols-1 gap-3.5 @sm/quick-product:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="quick-product-sku">SKU</Label>
                  <Input
                    id="quick-product-sku"
                    placeholder="Ej. PROD-001"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.sku}
                    className="font-mono"
                    {...register('sku')}
                  />
                  {errors.sku && (
                    <p className="text-sm text-destructive">{errors.sku.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="quick-product-barcode">Código de barras</Label>
                  <Input
                    id="quick-product-barcode"
                    placeholder="Ej. 7501234567890"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.barcode}
                    className="font-mono"
                    {...register('barcode')}
                  />
                  {errors.barcode && (
                    <p className="text-sm text-destructive">{errors.barcode.message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="quick-product-description">Descripción</Label>
                <textarea
                  id="quick-product-description"
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
                <Label htmlFor="quick-product-unitOfMeasure">Unidad de medida</Label>
                <Controller
                  control={control}
                  name="unitOfMeasure"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? 'UNIT'}
                      onValueChange={(value: unknown) => field.onChange(value as string)}
                    >
                      <SelectTrigger
                        id="quick-product-unitOfMeasure"
                        disabled={isSubmitting}
                        aria-invalid={!!errors.unitOfMeasure}
                      >
                        <SelectValue>
                          {(value: unknown) => UNIT_LABELS[value as string] ?? 'Unidad'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNIT">Unidad</SelectItem>
                        <SelectItem value="KILOGRAM">Kilogramo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unitOfMeasure && (
                  <p className="text-sm text-destructive">{errors.unitOfMeasure.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="quick-product-isVariableWeight"
                  type="checkbox"
                  disabled={isSubmitting}
                  className={checkboxClassName}
                  {...register('isVariableWeight')}
                />
                <Label htmlFor="quick-product-isVariableWeight">Peso variable</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="quick-product-trackInventory"
                  type="checkbox"
                  disabled={isSubmitting}
                  className={checkboxClassName}
                  {...register('trackInventory')}
                />
                <Label htmlFor="quick-product-trackInventory">Controlar inventario</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="quick-product-active"
                  type="checkbox"
                  disabled={isSubmitting}
                  className={checkboxClassName}
                  {...register('active')}
                />
                <Label htmlFor="quick-product-active">Producto activo</Label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
