import type { BaseSyntheticEvent, ComponentType, ReactNode } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, DollarSign, Tags } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { createProductSchema, updateProductSchema } from '../schemas/product.schema'
import { calculateCostPreview } from '../utils/costEnginePreview'
import { ProductCabysField } from './ProductCabysField'
import { ProductCategoryField } from './ProductCategoryField'
import { ProductImageField } from './ProductImageField'
import { ProductInventoryWorkspace } from './ProductInventoryWorkspace'
import { ProductStatusBadge } from './ProductStatusBadge'
import { ProductTaxField } from './ProductTaxField'
import type { CreateProductDto } from '../types/product.types'

interface SelectOption {
  id: string
  name: string
  /** Mejora UX (indicador visual del impuesto oficial CABYS): tasa del
   * impuesto (puntos porcentuales) — `undefined` si quien construye este
   * arreglo no la trae (compatibilidad hacia atras: sin esto, el indicador
   * simplemente no se muestra, nada mas cambia). */
  rate?: number
}

interface ProductFormProps {
  /** Determina que schema de validacion se usa y que campos se muestran. */
  mode: 'create' | 'update'
  /** Valores iniciales del formulario (por ejemplo, al editar un producto). */
  defaultValues?: Partial<CreateProductDto>
  /** Opciones para el selector de impuesto. */
  taxes: SelectOption[]
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CreateProductDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** Imagen actual del producto (con `?v=` de cache-busting ya resuelto
   * por el backend). En creacion, el producto no existe todavia asi que
   * siempre es `null`/`undefined` hasta que se guarda por primera vez. */
  imageUrl?: string | null
  /** Estado activo/inactivo mostrado en la banda de identidad en modo
   * edicion — `UpdateProductDto` no incluye `active` (el backend lo
   * maneja aparte, ver `product.schema.ts`), asi que el formulario no lo
   * observa por `watch()` en este modo; se muestra el valor ya conocido
   * del producto. */
  initialActive?: boolean
  /** Bloque 10 (gestion de imagenes): se dispara con el archivo ya
   * validado apenas el usuario lo elige/suelta en `ProductImageField`. En
   * modo edicion, quien use `ProductForm` normalmente sube la imagen de
   * inmediato (el producto ya existe); en creacion, normalmente la
   * guarda en memoria y la sube recien despues de crear el producto (ver
   * `CreateProductPage.tsx`). */
  onImageFileSelected: (file: File) => void
  /** Se dispara al presionar "Eliminar imagen" en `ProductImageField`. */
  onImageRemove: () => void
  isImageUploading?: boolean
  isImageDeleting?: boolean
  /** Error de la ultima operacion de imagen (subida o borrado) — mensaje
   * ya traducido (`getProductImageErrorMessage`), no un `AxiosError` crudo. */
  imageError?: string | null
  /** Rediseño de Productos: id del producto real — solo existe en edicion
   * (`EditProductPage.tsx`). Habilita el contenido real del bloque
   * "Configuración e inventario" (`ProductInventoryWorkspace.tsx`), que
   * necesita un producto ya persistido para consultar existencia/lotes. */
  productId?: string
  /** Rediseño de Productos: `Product.updatedAt` — mostrado en la banda de
   * identidad. Solo en edición; en creación el producto todavia no tiene
   * historial. */
  updatedAt?: string
  /** Rediseño de Productos: acción rápida "Guardar y crear otro" — mismo
   * `handleSubmit`/validación que `onSubmit`, pero quien la usa
   * (`CreateProductPage.tsx`) no navega al terminar, y este formulario se
   * reinicia (`resetForm`) para cargar el siguiente producto sin salir de
   * la pantalla. Solo tiene sentido en `mode === 'create'`. */
  onSubmitAndCreateAnother?: (values: CreateProductDto, resetForm: () => void) => void
  /** Rediseño de Productos: acciones adicionales visibles junto a
   * "Guardar" (ej. "Duplicar producto"/"Activar-Desactivar" en edición) —
   * este componente no conoce esa lógica de página, solo reserva el
   * espacio visible para que quien lo use no tenga que esconderlas en un
   * menú. */
  secondaryActions?: ReactNode
}

const textareaClassName =
  'flex min-h-14 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const UNIT_LABELS: Record<string, string> = {
  UNIT: 'Unidad',
  KILOGRAM: 'Kilogramo',
}

/** Encabezado liviano de cada columna del cuerpo en grilla — icono +
 * titulo, SIN envoltorio de tarjeta (a diferencia del extinto
 * `FormSection`, que seguia envolviendo cada bloque en su propia `Card`
 * con borde/sombra propios — exactamente lo que este rediseño elimina).
 * Local a este archivo: las 3 columnas del Canvas Workspace son la unica
 * consumidora. */
function ColumnHeading({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="size-4 text-brand" />
      {children}
    </div>
  )
}

/** Fila de switch "lista compacta" — sin tarjeta ni borde propio (a
 * diferencia de "Peso variable" en Clasificación o "Aplicar merma
 * esperada al costo" en Precio y costo, que SI llevan un borde liviano
 * porque viven en columnas de estilo "formulario"/"dashboard"). Requisito
 * explicito del bloque: "Configuración e inventario" debe leerse como
 * lista, no como otra tarjeta igual a las demas. */
function CompactSwitchRow({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

/**
 * features/products/components/ProductForm.tsx
 * -----------------------------------------------------------------------------
 * "Canvas Workspace" (aprobado tras análisis de UX estructural — la
 * primera pasada de este bloque solo había quitado las `Tabs`, dejando un
 * CRUD tradicional de tarjetas apiladas; esta versión reemplaza esa
 * composición por completo). Mismos campos, mismos `name`/`register`/
 * `Controller`, mismo `createProductSchema`/`updateProductSchema`, mismo
 * `handleSubmit` — el cambio sigue siendo exclusivamente de COMPOSICIÓN.
 *
 * Estructura (una única superficie, sin tarjetas independientes, mismo
 * lenguaje que `ProductsPage.tsx` — borde/sombra en el contenedor
 * exterior, divisores internos en vez de chrome repetido por sección):
 *
 * 1. Banda de identidad ("Hero"), ancho completo, arriba: imagen
 *    interactiva con mucho más protagonismo (`size-32`/`size-36`, antes
 *    `size-20` en el extinto panel lateral) + Nombre/Descripción/SKU/
 *    Código de barras + Precio de venta y Estado destacados a la
 *    derecha. Es la fusión total de lo que antes eran 3 superficies
 *    separadas ("Información general", imagen del panel, KPI de precio
 *    del panel): ahora se lee como una sola idea — "esto es, así se ve,
 *    esto vale" — apenas se abre el formulario.
 * 2. Cuerpo en grilla de 3 columnas DESIGUALES (`minmax(0,0.85fr)
 *    minmax(0,1.3fr) minmax(0,0.85fr)`, no 33/33/33 — "Precio y costo"
 *    recibe más ancho porque su contenido (simulación) es el
 *    protagonista visual del bloque), separadas por divisores internos
 *    (`divide-x`/`divide-y`), NO por tarjetas independientes:
 *    - "Clasificación": estilo formulario limpio (Categoría/Impuesto/
 *      Unidad + "Peso variable", agrupados porque es la misma decisión
 *      de negocio que la unidad de medida).
 *    - "Precio y costo": estilo dashboard — fondo con un tinte de marca
 *      sutil propio (`bg-brand/[0.035]`, distinto a las columnas
 *      vecinas) y la Simulación (Costo efectivo/Utilidad/Margen) como
 *      tarjetas destacadas de mayor tamaño, el elemento visualmente más
 *      importante de la columna.
 *    - "Configuración e inventario": lista compacta (`CompactSwitchRow`,
 *      sin tarjeta por fila) + contenido real de inventario/lotes en
 *      edición, o la nota informativa en creación.
 * 3. Barra de acciones al final del propio Workspace — liviana
 *    (`border-t`, sin fondo opaco pesado), integrada visualmente a la
 *    misma superficie.
 *
 * Correccion de causa raiz (aprobado, "aparece un pequeño scroll interno
 * cuando se muestra la Simulación — no debe existir ningun scroll
 * interno"): la barra de acciones era `sticky bottom-0`. El
 * `<div className="min-h-0 flex-1 overflow-y-auto">` de
 * `DashboardLayout.tsx` es el UNICO contenedor con scroll real de toda
 * la pantalla — un elemento `sticky` dentro de el no crea, por si solo,
 * una region de scroll propia. El problema real era que la altura de
 * ese contenedor variaba: cuando el precio de venta se carga y aparece
 * la Simulación (columna "Precio y costo"), el resto de las columnas se
 * estiran para igualar esa altura (comportamiento por defecto de CSS
 * Grid, `align-items: stretch`), y ese cambio de altura, combinado con
 * el recalculo de la posicion "pegada" del elemento `sticky` en cada
 * frame de scroll/resize, era lo que se percibia como un scroll extra de
 * pocos pixeles — un efecto secundario del propio `sticky`, no del
 * `overflow-y-auto` de `DashboardLayout.tsx` (que no se toca). Fix de
 * causa raiz: la barra deja de ser `sticky` — vuelve a ser un pie de
 * pagina normal, dentro del flujo del documento, al final del propio
 * Workspace. El Workspace completo crece junto con el documento sin
 * ninguna superficie de scroll propia, exactamente lo pedido.
 *
 * Ajuste de altura disponible (aprobado, "sigue apareciendo un pequeño
 * scrollbar al mostrar la Simulación"): sin cambiar el layout, las 3
 * columnas ni ningun componente, se recorto el padding VERTICAL propio
 * del contenedor (no de las tarjetas de KPI/Simulacion en si, que
 * conservan su tamaño intacto) en los 4 bloques del Workspace — Hero,
 * las 3 columnas y el pie de pagina (`p-5`→`px-5 py-4` en Hero/columnas,
 * `py-3.5`→`py-3` en el pie) — mas el espacio entre el `PageHeader` y el
 * Workspace en `CreateProductPage.tsx`/`EditProductPage.tsx`
 * (`gap-4`→`gap-3`). Recupera el espacio vertical "de aire" alrededor del
 * contenido real (no el contenido en si) para que la altura total del
 * Workspace, incluida la Simulación, entre sin scroll en la mayoria de
 * resoluciones de escritorio estandar.
 *
 * Segundo ajuste (aprobado, "faltan ~20-30px para eliminar el scroll
 * definitivamente"): mismo criterio, sin tocar tarjetas/inputs/
 * simulación/switches ni la separación entre bloques del Workspace. Dos
 * ajustes puntuales de "espacio inferior": el pie de pagina gana un
 * `pb-2.5` propio (antes `py-3` simetrico, ahora `pt-3 pb-2.5`), y
 * `DashboardLayout.tsx` recibe una prop nueva, opcional y aditiva,
 * `compactBottomSpacing` (`pb-8`→`pb-3` del padding inferior de PAGINA,
 * el mismo para cualquier pantalla — no exclusivo de este Workspace),
 * activada unicamente en las rutas `/products/new` y `/products/:id/edit`
 * (`routes/index.tsx`). El resto del ERP no cambia: el prop es `false`
 * por defecto.
 *
 * "Peso variable"/"Controlar inventario"/"Usa control por lotes"/
 * "Producto activo" (creación) mantienen un único lugar de edición cada
 * uno (sin duplicados): "Peso variable" en "Clasificación", el resto en
 * "Configuración e inventario" — igual que en la pasada anterior, solo
 * que ahora ambas columnas conviven en la misma superficie.
 *
 * El panel lateral independiente (`ProductFormSummary.tsx`) SE ELIMINÓ —
 * cada responsabilidad que tenía encontró un lugar más coherente dentro
 * del Canvas: imagen/nombre/precio/estado en la banda de identidad,
 * switches de configuración en la tercera columna, "Última modificación"
 * como dato chico dentro de la banda de identidad. `ProductImageField.tsx`
 * (Bloque 10, SIN modificar) se renderiza ahora directo en este archivo.
 *
 * Categoria/Impuesto viven en `ProductCategoryField.tsx`/`ProductTaxField.tsx`
 * (extraidos, no redefinidos aca) — el mismo motivo por el que se sacaron:
 * `QuickProductForm.tsx` (creacion rapida desde Compras) los reutiliza tal
 * cual, sin duplicar esta logica.
 */
export function ProductForm({
  mode,
  defaultValues,
  taxes,
  isSubmitting = false,
  onSubmit,
  onCancel,
  imageUrl,
  initialActive,
  onImageFileSelected,
  onImageRemove,
  isImageUploading = false,
  isImageDeleting = false,
  imageError,
  productId,
  updatedAt,
  onSubmitAndCreateAnother,
  secondaryActions,
}: ProductFormProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProductDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CreateProductDto | UpdateProductDto>` que
    // exponen los schemas de product.schema.ts (no se modifica ese
    // archivo desde aqui). Mismo cast usado en UserForm.tsx/RoleForm.tsx
    // por el mismo motivo.
    resolver: zodResolver(
      (mode === 'create' ? createProductSchema : updateProductSchema) as never,
    ) as unknown as Resolver<CreateProductDto>,
    defaultValues,
  })

  const handleFormSubmit = handleSubmit((values) => onSubmit(values))

  // Rediseño de Productos: "Guardar y crear otro" — misma validación
  // (`handleSubmit`), pero llama a `onSubmitAndCreateAnother` en vez de
  // `onSubmit`, pasándole `reset` para que quien lo use (`CreateProductPage.tsx`)
  // reinicie el formulario recién cuando la creación termine con éxito
  // (nunca antes, para no perder los datos si la mutación falla).
  const handleFormSubmitAndCreateAnother = handleSubmit((values) =>
    onSubmitAndCreateAnother?.(values, () => reset()),
  )

  // Este formulario se usa tanto en paginas propias (CreateProductPage/
  // EditProductPage, sin ningun `<form>` ancestro) como embebido dentro de
  // un dialogo abierto desde otro formulario (`ProductSearchDialog.tsx`,
  // montado dentro de `PurchaseForm.tsx`). El dialogo usa un `Portal`
  // (`components/ui/Dialog.tsx`), asi que ambos `<form>` no quedan
  // anidados en el DOM real — pero React sigue tratando el `submit` como
  // si burbujeara por el arbol de componentes (asi trata React los
  // portales para eventos, no solo para contexto). Sin este
  // `stopPropagation`, guardar un producto desde ese dialogo tambien
  // dispararia el submit del formulario de compra que lo contiene. Es un
  // no-op inofensivo en el caso normal (paginas propias, sin ancestro).
  const submit = (event?: BaseSyntheticEvent) => {
    event?.stopPropagation()
    return handleFormSubmit(event)
  }

  // `useWatch` (no `watch()` de `useForm()`): la funcion `watch()` no es
  // compatible con la memoizacion del React Compiler (lint
  // `react-hooks/incompatible-library`) — `useWatch` si lo es, mismo
  // criterio ya usado en `InventoryWasteForm.tsx`/`PurchaseItemRow.tsx`
  // para leer un valor controlado sin ese problema.
  const watchedName = useWatch({ control, name: 'name' })
  const watchedSalePrice = useWatch({ control, name: 'salePrice' })
  const watchedUnitOfMeasure = useWatch({ control, name: 'unitOfMeasure' })
  const watchedActive = useWatch({ control, name: 'active' })
  // Mejora UX (indicador visual del impuesto oficial CABYS): resuelve la
  // tasa del impuesto actualmente elegido contra `taxes` (prop) para
  // pasarsela a `ProductCabysField` — puramente informativo/preventivo,
  // no participa de ninguna validacion.
  const watchedTaxId = useWatch({ control, name: 'taxId' })
  const selectedTaxRate = taxes.find((tax) => tax.id === watchedTaxId)?.rate ?? null
  // Bloque COST-05: alimentan unicamente la vista previa del costo
  // efectivo (`calculateCostPreview`, mas abajo) — nunca se envian al
  // backend como un valor calculado, solo se leen para decidir que
  // mostrar mientras el usuario edita.
  const watchedCost = useWatch({ control, name: 'cost' })
  const watchedExpectedWastePercent = useWatch({
    control,
    name: 'expectedWastePercent',
  })
  const watchedApplyExpectedWasteToCost = useWatch({
    control,
    name: 'applyExpectedWasteToCost',
  })

  const costPreview = calculateCostPreview({
    averageCost: watchedCost,
    wastePercent: watchedExpectedWastePercent,
    applyExpectedWasteToCost: watchedApplyExpectedWasteToCost ?? false,
  })

  // Rediseño de Productos — simulación comercial ("Precio y costo"): costo
  // EFECTIVO (con merma, cuando aplica) contra el precio de venta — mismo
  // criterio ya usado en `ProductDrawer.tsx` para "Margen"
  // (`((salePrice - cost) / salePrice) * 100`), solo que aca se usa el
  // costo efectivo (`costPreview`, ya calculado arriba) en vez del costo
  // promedio crudo cuando la merma esperada está activa. Sin motor de
  // cálculo nuevo.
  const effectiveCostForMargin = costPreview?.effectiveCost ?? watchedCost ?? 0
  const unitProfit = (watchedSalePrice ?? 0) - effectiveCostForMargin
  const grossMarginPercent =
    watchedSalePrice && watchedSalePrice > 0 ? (unitProfit / watchedSalePrice) * 100 : null

  const activeForBadge = mode === 'create' ? (watchedActive ?? false) : (initialActive ?? false)

  return (
    <form onSubmit={submit} noValidate className="@container/product-form">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        {/* Banda de identidad ("Hero") — ver doc del componente arriba. */}
        <div className="flex flex-col gap-5 border-b border-border px-5 py-4 @lg/product-form:flex-row @lg/product-form:items-start">
          <ProductImageField
            currentImageUrl={imageUrl}
            productName={watchedName || ''}
            onFileSelected={onImageFileSelected}
            onRemove={onImageRemove}
            isUploading={isImageUploading}
            isDeleting={isImageDeleting}
            error={imageError}
            thumbnailContainerClassName="size-32 shrink-0 rounded-2xl border @lg/product-form:size-36"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="product-form-name">
                Nombre
                <RequiredMark />
              </Label>
              <Input
                id="product-form-name"
                disabled={isSubmitting}
                aria-invalid={!!errors.name}
                className="h-10 text-lg font-semibold"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="product-form-description">Descripción</Label>
              <textarea
                id="product-form-description"
                disabled={isSubmitting}
                aria-invalid={!!errors.description}
                className={textareaClassName}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="product-form-sku">SKU</Label>
                <Input
                  id="product-form-sku"
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
                <Label htmlFor="product-form-barcode">Código de barras</Label>
                <Input
                  id="product-form-barcode"
                  placeholder="Ej. 7501234567890"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.barcode}
                  className="font-mono"
                  {...register('barcode')}
                />
                {errors.barcode && (
                  <p className="text-sm text-destructive">
                    {errors.barcode.message}
                  </p>
                )}
              </div>

              <Controller
                control={control}
                name="cabysCode"
                render={({ field }) => (
                  <ProductCabysField
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={errors.cabysCode?.message}
                    disabled={isSubmitting}
                    selectedTaxRate={selectedTaxRate}
                  />
                )}
              />
            </div>

            {updatedAt && (
              <p className="text-xs text-muted-foreground">
                Última modificación: {formatDateTime(updatedAt)}
              </p>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 @lg/product-form:w-56">
            <div className="rounded-xl border border-brand/15 bg-brand/5 p-3.5">
              <Label htmlFor="product-form-salePrice" className="text-brand/70">
                Precio de venta
                <RequiredMark />
              </Label>
              <Input
                id="product-form-salePrice"
                type="number"
                step="0.01"
                disabled={isSubmitting}
                aria-invalid={!!errors.salePrice}
                className="mt-1 h-11 border-brand/20 bg-card text-2xl font-bold text-brand tabular-nums"
                {...register('salePrice', { valueAsNumber: true })}
              />
              {errors.salePrice && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.salePrice.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Estado</span>
              <ProductStatusBadge active={activeForBadge} />
            </div>
          </div>
        </div>

        {/* Cuerpo en grilla de 3 columnas desiguales — ver doc arriba. */}
        <div className="grid grid-cols-1 divide-y divide-border @lg/product-form:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)_minmax(0,0.85fr)] @lg/product-form:divide-x @lg/product-form:divide-y-0">
          {/* Clasificación — estilo formulario limpio. */}
          <div className="flex flex-col gap-3.5 px-5 py-4">
            <ColumnHeading icon={Tags}>Clasificación</ColumnHeading>

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

            <div className="flex flex-col gap-1">
              <Label htmlFor="product-form-unitOfMeasure">Unidad de medida</Label>
              <Controller
                control={control}
                name="unitOfMeasure"
                render={({ field }) => (
                  <Select
                    value={field.value ?? 'UNIT'}
                    onValueChange={(value: unknown) => field.onChange(value as string)}
                  >
                    <SelectTrigger
                      id="product-form-unitOfMeasure"
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

            {/* "Peso variable" vive aca, junto a Unidad de medida — misma
                decision de negocio (solo aplica a KILOGRAM). */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3.5 py-3">
              <Label htmlFor="product-form-isVariableWeight">Peso variable</Label>
              <Controller
                control={control}
                name="isVariableWeight"
                render={({ field }) => (
                  <Switch
                    id="product-form-isVariableWeight"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          </div>

          {/* Precio y costo — estilo dashboard/KPI, tinte propio, la
              Simulación es el protagonista visual de la columna. */}
          <div className="flex flex-col gap-3.5 bg-brand/[0.035] px-5 py-4">
            <ColumnHeading icon={DollarSign}>Precio y costo</ColumnHeading>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="product-form-cost">
                  Costo
                  <RequiredMark />
                </Label>
                <Input
                  id="product-form-cost"
                  type="number"
                  step="0.01"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.cost}
                  className="bg-card"
                  {...register('cost', { valueAsNumber: true })}
                />
                {errors.cost && (
                  <p className="text-sm text-destructive">{errors.cost.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="product-form-expectedWastePercent">Merma (%)</Label>
                <div className="relative">
                  <Input
                    id="product-form-expectedWastePercent"
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.expectedWastePercent}
                    className="bg-card pr-7"
                    {...register('expectedWastePercent', {
                      // Fix (aprobado, "campo vacio no debe mostrar NaN"):
                      // `valueAsNumber` lee `input.valueAsNumber`, que para
                      // un campo numerico vacio es `NaN` — Zod (`z.number()`)
                      // rechaza `NaN` explicitamente ("expected number,
                      // received NaN"), un error que no tiene sentido
                      // mostrarle al usuario por simplemente no haber
                      // escrito nada. `setValueAs` reemplaza esa lectura:
                      // string vacio -> `0` (merma esperada por defecto),
                      // cualquier otro valor -> `Number(value)` como antes.
                      // El schema (`product.schema.ts`) no se toca: sigue
                      // validando rango (`min(0)`/`lt(100)`) exactamente
                      // igual, ahora siempre contra un numero real.
                      setValueAs: (value: string) => (value === '' ? 0 : Number(value)),
                    })}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                {/* Pulido "Análisis de mermas" (aprobado): ayuda discreta,
                    mismo criterio de caption ya usado en el resto del ERP
                    (ej. "Se preselecciona automáticamente..." en
                    TaxForm.tsx) — aclara que este campo es solo para
                    comparación (vs. la merma real en `InventoryWasteAnalysis.tsx`),
                    no una operación de descuento de inventario. No cambia
                    el campo, su validación ni `applyExpectedWasteToCost`
                    (eso sigue siendo una opción aparte, ya existente). */}
                <p className="text-xs text-muted-foreground">
                  Se utiliza únicamente para comparar el rendimiento real del producto. No
                  descuenta inventario automáticamente.
                </p>
              </div>
            </div>
            {errors.expectedWastePercent && (
              <p className="-mt-2 text-sm text-destructive">
                {errors.expectedWastePercent.message}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3.5 py-3">
              <Label htmlFor="product-form-applyExpectedWasteToCost" className="text-sm">
                Aplicar merma al costo
              </Label>
              <Controller
                control={control}
                name="applyExpectedWasteToCost"
                render={({ field }) => (
                  <Switch
                    id="product-form-applyExpectedWasteToCost"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {watchedApplyExpectedWasteToCost
                ? 'Se utilizará el costo efectivo para validar ventas y calcular utilidades.'
                : 'Se utilizará el costo promedio para las validaciones.'}
            </p>

            {/* Simulación — protagonista visual de esta columna. Unica
                aparicion de Costo efectivo/Utilidad/Margen en toda la
                pantalla (ya no se duplica en ningun panel lateral). */}
            <div className="flex flex-col gap-2.5 border-t border-brand/15 pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Simulación
              </p>
              {watchedSalePrice ? (
                <>
                  <div className="rounded-xl border border-brand/15 bg-card p-3.5">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Costo efectivo
                    </p>
                    <p className="mt-0.5 text-2xl font-bold tabular-nums text-brand">
                      {formatCurrency(effectiveCostForMargin)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-brand/15 bg-card p-3">
                      <p className="text-xs text-muted-foreground">Utilidad/unidad</p>
                      <p
                        className={cn(
                          'mt-0.5 text-lg font-bold tabular-nums',
                          unitProfit < 0 ? 'text-destructive' : 'text-brand',
                        )}
                      >
                        {formatCurrency(unitProfit)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand/15 bg-card p-3">
                      <p className="text-xs text-muted-foreground">Margen bruto</p>
                      <p
                        className={cn(
                          'mt-0.5 text-lg font-bold tabular-nums',
                          grossMarginPercent !== null && grossMarginPercent < 0
                            ? 'text-destructive'
                            : 'text-brand',
                        )}
                      >
                        {grossMarginPercent !== null ? `${grossMarginPercent.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cargá un precio de venta para ver la simulación de utilidad y margen.
                </p>
              )}
            </div>
          </div>

          {/* Configuración e inventario — lista compacta, sin tarjeta por
              fila (a diferencia de las otras 2 columnas). */}
          <div className="flex flex-col gap-3.5 px-5 py-4">
            <ColumnHeading icon={Boxes}>Configuración e inventario</ColumnHeading>

            <div className="flex flex-col divide-y divide-border">
              {mode === 'create' && (
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <CompactSwitchRow
                      label="Producto activo"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
              )}
              <Controller
                control={control}
                name="trackInventory"
                render={({ field }) => (
                  <CompactSwitchRow
                    label="Controlar inventario"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
              <Controller
                control={control}
                name="requiresBatch"
                render={({ field }) => (
                  <CompactSwitchRow
                    label="Usa control por lotes"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>

            <div className="border-t border-border pt-3">
              {productId ? (
                <ProductInventoryWorkspace
                  productId={productId}
                  unitOfMeasure={watchedUnitOfMeasure ?? 'UNIT'}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  La existencia real, el punto de reorden y los lotes activos estarán
                  disponibles después de guardar el producto por primera vez.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Barra de acciones — pie de pagina normal (no `sticky`, ver
            doc arriba: causa raiz del scroll interno). */}
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border px-5 pt-3 pb-2.5">
          {onCancel && (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancelar
            </Button>
          )}
          {secondaryActions}
          {onSubmitAndCreateAnother && (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={handleFormSubmitAndCreateAnother}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar y crear otro'}
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
