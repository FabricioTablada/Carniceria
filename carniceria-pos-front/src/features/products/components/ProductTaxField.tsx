import { Controller, type Control } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CreateProductDto } from '../types/product.types'

interface SelectOption {
  id: string
  name: string
}

interface ProductTaxFieldProps {
  control: Control<CreateProductDto>
  /** Opciones para el selector de impuesto. */
  taxes: SelectOption[]
  /** Mensaje de error de validacion (`errors.taxId?.message`). */
  error?: string
  disabled?: boolean
}

/**
 * features/products/components/ProductTaxField.tsx
 * -----------------------------------------------------------------------------
 * Extraido de `ProductForm.tsx`, sin ningun cambio de comportamiento —
 * mismo `Select`, mismo `Controller`, misma resolucion manual del nombre
 * (`SelectValue` no deriva el label de los `SelectItem` renderizados en
 * `@base-ui/react`). Se extrae para que `ProductForm` (formulario
 * completo) y `QuickProductForm` (creacion rapida desde Compras) lo
 * compartan, en vez de repetir este bloque en los dos. A diferencia de
 * `ProductCategoryField.tsx`, el campo de impuesto no cambia de
 * `Select` a buscador en este bloque — no fue parte del alcance pedido.
 */
export function ProductTaxField({ control, taxes, error, disabled = false }: ProductTaxFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="product-form-taxId">
        Impuesto
        <RequiredMark />
      </Label>
      <Controller
        control={control}
        name="taxId"
        render={({ field }) => (
          <Select
            value={field.value ?? ''}
            onValueChange={(value: unknown) => field.onChange(value as string)}
          >
            <SelectTrigger
              id="product-form-taxId"
              disabled={disabled}
              aria-invalid={!!error}
            >
              <SelectValue>
                {(value: unknown) => {
                  const taxId = value as string
                  if (!taxId) return 'Selecciona un impuesto'
                  return taxes.find((tax) => tax.id === taxId)?.name ?? taxId
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {taxes.map((tax) => (
                <SelectItem key={tax.id} value={tax.id}>
                  {tax.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
