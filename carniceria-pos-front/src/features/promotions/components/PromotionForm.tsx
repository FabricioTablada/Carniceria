import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  BadgeCheck,
  CalendarClock,
  Compass,
  Handshake,
  Layers,
  Percent,
  Scale,
} from 'lucide-react'
import { ActiveStatusBadge } from '@/components/common/ActiveStatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { Switch } from '@/components/ui/switch'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { createPromotionSchema, updatePromotionSchema } from '../schemas/promotion.schema'
import { emptyToUndefined, emptyToUndefinedNumber } from '../utils/emptyValue'
import { buildPromotionNarrative } from '../utils/promotionNarrative'
import { EffectCards } from './EffectCards'
import { PromotionCompatibilityFields } from './PromotionCompatibilityFields'
import { PromotionFundingFields } from './PromotionFundingFields'
import { PromotionLivePanel } from './PromotionLivePanel'
import { PromotionOriginFields } from './PromotionOriginFields'
import {
  PromotionStepRail,
  type PromotionStepDefinition,
  type PromotionStepId,
  type PromotionStepStatus,
} from './PromotionStepRail'
import { ScopeCards } from './ScopeCards'
import { VigenciaSection } from './VigenciaSection'
import type { CreatePromotionDto, PromotionProductInput } from '../types/promotion.types'

interface PromotionFormProps {
  /** Determina que schema de validacion se usa. */
  mode: 'create' | 'update'
  /** Valores iniciales del formulario (por ejemplo, al editar una promocion). */
  defaultValues?: Partial<CreatePromotionDto>
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /**
   * Estado real ya persistido (`Promotion.active`) — solo relevante en
   * `mode: 'update'`, donde `active` no es parte de `updatePromotionSchema`
   * (el cambio de estado es una accion separada,
   * `useUpdatePromotionStatus`). Puramente informativo para
   * `PromotionLivePanel`/paso de Revisión, no se envia en el submit.
   */
  currentStatus?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CreatePromotionDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** QA.9 (Promociones): proveedor ya conocido de la promoción que se
   * esta editando — ver doc en `PromotionSupplierField.tsx`. */
  initialSupplier?: { id: string; name: string } | null
}

interface StepMeta {
  icon: typeof Compass
  title: string
  description: string
}

const STEP_META: Record<PromotionStepId, StepMeta> = {
  origin: {
    icon: Compass,
    title: 'Origen',
    description: '¿De quién es esta promoción? Esto decide si más adelante pedimos datos de un proveedor.',
  },
  scope: {
    icon: Layers,
    title: '¿A qué aplica?',
    description: 'Elegí primero a quién le vas a dar el descuento.',
  },
  effect: {
    icon: Percent,
    title: 'Beneficio',
    description: 'Cómo se calcula el descuento.',
  },
  conditions: {
    icon: CalendarClock,
    title: 'Condiciones',
    description: '¿Necesita una cantidad mínima? ¿Corre siempre o solo en ciertas fechas, horarios o días?',
  },
  combination: {
    icon: Scale,
    title: 'Combinación',
    description: '¿Cómo convive con otras promociones activas al mismo tiempo?',
  },
  funding: {
    icon: Handshake,
    title: 'Financiamiento',
    description: 'Proveedor y quién paga el descuento que ve el cliente.',
  },
  review: {
    icon: BadgeCheck,
    title: 'Revisión',
    description: 'Así queda la promoción — activala o guardala como borrador.',
  },
}

const STEP_ORDER: PromotionStepId[] = [
  'origin',
  'scope',
  'effect',
  'conditions',
  'combination',
  'funding',
  'review',
]

/**
 * features/promotions/components/PromotionForm.tsx
 * -----------------------------------------------------------------------------
 * Bloque 1 (rediseño de Promociones, aprobado — "Opción 2, artifact al
 * 100% dentro de DashboardLayout"): riel de 7 pasos (Origen, Alcance,
 * Beneficio, Condiciones, Combinación, Financiamiento —condicional—,
 * Revisión), UN paso visible a la vez ocupando casi toda el área de
 * trabajo, navegación completamente libre (ningún paso bloquea a otro,
 * cambiar de paso nunca pierde datos de los demás porque todos son
 * campos de la MISMA instancia de `useForm`), y el panel lateral de
 * simulación comercial siempre visible. Todo dentro de `DashboardLayout`
 * (sin pantalla propia): este módulo sigue siendo parte del ERP, no una
 * aplicación aparte como el POS.
 *
 * Reutiliza EXACTAMENTE el mismo estado/lógica de siempre: mismo
 * `useForm` (mismo `createPromotionSchema`/`updatePromotionSchema`), mismo
 * estado local `selectedProducts`/`selectedCategoryIds` y sus handlers,
 * mismos componentes de campos (`ScopeCards`, `EffectCards`,
 * `VigenciaSection`, y los 3 extraídos de `AdvancedRulesSection.tsx`:
 * `PromotionOriginFields`/`PromotionCompatibilityFields`/
 * `PromotionFundingFields`) — ninguna regla de validación, ningún payload
 * de envío cambia. Lo único nuevo es CÓMO se recorren: un paso a la vez,
 * elegido libremente desde `PromotionStepRail`, en vez de todo apilado en
 * una sola página larga.
 *
 * Workspace Promociones (aprobado, "mismo Canvas que Productos/
 * Categorías/Impuestos, sin simplificar el formulario"): NO se aplana la
 * navegación por pasos ni el panel en vivo — ambos se mantienen intactos
 * (son la respuesta correcta a 6 grupos de configuración genuinamente
 * independientes, a diferencia de los formularios chicos del resto del
 * ERP). Lo que cambia es el envoltorio: antes eran 3 superficies sueltas
 * (`PromotionStepRail`/paso activo/`PromotionLivePanel`, cada una con su
 * propio `rounded-xl border bg-card`) más la barra superior de Nombre —
 * ahora es UNA sola superficie (`rounded-2xl border bg-card shadow-sm`),
 * con divisores internos (`lg:divide-x`) en vez de chrome repetido, mismo
 * criterio que la grilla de 3 columnas de `ProductForm.tsx`. "Nombre" y
 * "Estado" suben a una banda de identidad siempre visible arriba (mismo
 * patrón que Productos/Categorías/Impuestos: `Switch` en creación,
 * `ActiveStatusBadge` de solo lectura en edición — antes el estado vivía
 * como checkbox nativo dentro del paso "Revisión", ahora es visible sin
 * importar en qué paso esté el usuario). Cancelar/Guardar se mudan de la
 * barra superior a un pie de página inferior, mismo lugar que el resto
 * del ERP. `PromotionStepRail.tsx`/`PromotionLivePanel.tsx` pierden su
 * borde/fondo propios (single consumer cada uno, se editan directo en
 * vez de agregar un prop `bare` — no hay otro consumidor que preservar).
 */
export function PromotionForm({
  mode,
  defaultValues,
  isSubmitting = false,
  currentStatus,
  onSubmit,
  onCancel,
  initialSupplier = null,
}: PromotionFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreatePromotionDto>({
    resolver: zodResolver(
      (mode === 'create' ? createPromotionSchema : updatePromotionSchema) as never,
    ) as unknown as Resolver<CreatePromotionDto>,
    defaultValues: {
      priority: 0,
      stackable: false,
      active: true,
      daysOfWeek: [],
      // PROMO-07: mismos defaults que aplica el backend (`promotions.service.ts`).
      commercialOrigin: 'INTERNAL',
      fundingType: 'NONE',
      ...defaultValues,
    },
  })

  const [selectedProducts, setSelectedProducts] = useState<PromotionProductInput[]>(
    defaultValues?.productIds ?? [],
  )
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    defaultValues?.categoryIds ?? [],
  )

  const [currentStep, setCurrentStep] = useState<PromotionStepId>('origin')

  // `limit: 100` (techo real del backend, `MAX_LIMIT`).
  const { data: productsResponse } = useProducts({ active: true, limit: 100 })
  // `useMemo` (no `?? []` suelto): sin esto, cada render crea un array
  // nuevo aunque `productsResponse` no haya cambiado, invalidando la
  // memoizacion de `referenceProduct` (mas abajo) en cada render.
  const products = useMemo(() => productsResponse?.data ?? [], [productsResponse])
  const { data: categoriesResponse } = useCategories({ active: true })
  const categories = useMemo(() => categoriesResponse?.data ?? [], [categoriesResponse])

  const submit = handleSubmit((values) =>
    onSubmit({
      ...values,
      productIds: selectedProducts,
      categoryIds: selectedCategoryIds,
    }),
  )

  // `productIds`/`categoryIds` no son campos registrados de RHF (viven en
  // `useState` de mas arriba), asi que el resolver de Zod los validaba con
  // el valor de RHF (nunca actualizado, siempre `undefined`) en vez del
  // valor real seleccionado por el usuario — el `.refine()` de
  // `createPromotionSchema` que exige "al menos un producto" para alcance
  // PRODUCT/COMBO fallaba SIEMPRE, aunque hubiera productos tildados.
  // Confirmado en vivo: se llenaba el formulario completo, se marcaba un
  // producto, y el submit igual devolvia "Debe seleccionar al menos un
  // producto...". Arreglo: espejar cada cambio de seleccion hacia RHF con
  // `setValue(..., { shouldValidate: true })`, para que el resolver vea el
  // mismo valor que ya se mergea manualmente en `submit`.
  const toggleProduct = (productId: string, checked: boolean) => {
    setSelectedProducts((prev) => {
      const next = checked
        ? [...prev, { productId, requiredQuantity: null }]
        : prev.filter((item) => item.productId !== productId)
      setValue('productIds', next, { shouldValidate: true })
      return next
    })
  }

  const updateRequiredQuantity = (productId: string, value: string) => {
    setSelectedProducts((prev) => {
      const next = prev.map((item) =>
        item.productId === productId
          ? { ...item, requiredQuantity: value === '' ? null : Number(value) }
          : item,
      )
      setValue('productIds', next, { shouldValidate: true })
      return next
    })
  }

  const toggleCategory = (categoryId: string, checked: boolean) => {
    setSelectedCategoryIds((prev) => {
      const next = checked ? [...prev, categoryId] : prev.filter((id) => id !== categoryId)
      setValue('categoryIds', next, { shouldValidate: true })
      return next
    })
  }

  // Observa TODO el formulario de una vez (en vez de 10+ `useWatch`
  // individuales) — el panel lateral y el riel de pasos necesitan la
  // mayoria de los campos igual, y `useWatch({ control })` sin `name` ya
  // es la forma recomendada por react-hook-form para ese caso.
  const watchedValues = useWatch({ control })

  // PROMO-08 + Bloque 1: se agregan `taxRate`/`unitOfMeasure` al mismo
  // producto de referencia que ya resolvia `EffectCards.tsx` (nombre/
  // precio) — la simulacion comercial completa (`PromotionLivePanel.tsx`)
  // los necesita para calcular impuestos y para mostrar la cantidad con
  // su unidad real (kg/unidades). Mismo dato ya cargado por
  // `useProducts`, sin ninguna consulta nueva.
  const referenceProduct = useMemo(() => {
    if (watchedValues.scopeType !== 'PRODUCT' && watchedValues.scopeType !== 'COMBO') return null
    const first = selectedProducts[0]
    if (!first) return null
    const product = products.find((item) => item.id === first.productId)
    return product
      ? {
          name: product.name,
          salePrice: product.salePrice,
          cost: product.cost,
          expectedWastePercent: product.expectedWastePercent,
          applyExpectedWasteToCost: product.applyExpectedWasteToCost,
          taxRate: product.tax.rate,
          unitOfMeasure: product.unitOfMeasure,
        }
      : null
  }, [watchedValues.scopeType, selectedProducts, products])

  const selectedNames =
    watchedValues.scopeType === 'CATEGORY'
      ? categories
          .filter((category) => selectedCategoryIds.includes(category.id))
          .map((category) => category.name)
      : (selectedProducts
          .map((item) => products.find((product) => product.id === item.productId)?.name)
          .filter((name): name is string => Boolean(name)))

  const hasScopeSelection =
    watchedValues.scopeType === 'CATEGORY' ? selectedCategoryIds.length > 0 : selectedProducts.length > 0

  const hasInitialVigencia = Boolean(
    defaultValues?.startDate ||
      defaultValues?.endDate ||
      defaultValues?.startTime ||
      defaultValues?.endTime ||
      (defaultValues?.daysOfWeek ?? []).length > 0,
  )

  const scopeComplete =
    watchedValues.scopeType != null && (watchedValues.scopeType === 'CART' || hasScopeSelection)
  const effectComplete =
    watchedValues.effectType === 'BUY_X_PAY_Y'
      ? watchedValues.buyQuantity != null && watchedValues.payQuantity != null
      : watchedValues.effectType != null && watchedValues.effectValue != null
  const hasVigenciaData = Boolean(
    watchedValues.startDate ||
      watchedValues.endDate ||
      watchedValues.startTime ||
      watchedValues.endTime ||
      (watchedValues.daysOfWeek ?? []).length > 0,
  )
  const hasConditionsData = Boolean(watchedValues.minQuantity != null || hasVigenciaData)
  const hasCombinationData = Boolean(
    (watchedValues.priority ?? 0) > 0 || watchedValues.stackable || watchedValues.exclusiveGroup,
  )
  const isSupplierMandated = (watchedValues.commercialOrigin ?? 'INTERNAL') === 'SUPPLIER_MANDATED'
  const fundingComplete =
    Boolean(watchedValues.supplierId) &&
    ((watchedValues.fundingType ?? 'NONE') === 'NONE' || watchedValues.supplierSubsidyValue != null)

  const stepStatus: Record<PromotionStepId, PromotionStepStatus> = {
    origin: 'neutral',
    scope: scopeComplete ? 'complete' : 'warning',
    effect: effectComplete ? 'complete' : 'warning',
    conditions: hasConditionsData ? 'complete' : 'neutral',
    combination: hasCombinationData ? 'complete' : 'neutral',
    funding: fundingComplete ? 'complete' : 'warning',
    review: 'neutral',
  }

  // El paso "Financiamiento" solo existe en el riel cuando el Paso
  // "Origen" es un acuerdo con proveedor — no se muestra vacío ni
  // deshabilitado, directamente no aparece (mismo criterio que el
  // artifact aprobado).
  const visibleStepIds = STEP_ORDER.filter((id) => id !== 'funding' || isSupplierMandated)
  const steps: PromotionStepDefinition[] = visibleStepIds.map((id) => ({
    id,
    label: STEP_META[id].title,
    status: stepStatus[id],
  }))

  // Si el usuario estaba en "Financiamiento" y cambia el Origen a "propia
  // del negocio", ese paso deja de existir en el riel — se lo saca de
  // "Financiamiento" hacia "Origen" en vez de dejarlo en un paso fantasma.
  // Ajuste DURANTE el render (no en un efecto: el linter de
  // `set-state-in-effect` lo rechaza como cascading render evitable) —
  // mismo patron ya usado en `SalesPOSPage.tsx` (`prevProductFilters`)
  // para resetear estado derivado cuando cambia un input.
  const [prevIsSupplierMandated, setPrevIsSupplierMandated] = useState(isSupplierMandated)
  if (prevIsSupplierMandated !== isSupplierMandated) {
    setPrevIsSupplierMandated(isSupplierMandated)
    if (currentStep === 'funding' && !isSupplierMandated) {
      setCurrentStep('origin')
    }
  }

  // Bloque 1: en creacion, el estado real es el checkbox del propio
  // formulario (`active`, con default `true`); en edicion ese campo no
  // existe en `updatePromotionSchema` (el cambio de estado es una accion
  // separada, `useUpdatePromotionStatus`) — se usa el estado ya
  // persistido que `EditPromotionPage.tsx` pasa por `currentStatus`.
  const isActive = mode === 'create' ? (watchedValues.active ?? true) : (currentStatus ?? true)

  const narrativeSentences = buildPromotionNarrative({
    scopeType: watchedValues.scopeType,
    effectType: watchedValues.effectType,
    effectValue: watchedValues.effectValue,
    buyQuantity: watchedValues.buyQuantity,
    payQuantity: watchedValues.payQuantity,
    minQuantity: watchedValues.minQuantity,
    startDate: watchedValues.startDate,
    endDate: watchedValues.endDate,
    startTime: watchedValues.startTime,
    endTime: watchedValues.endTime,
    daysOfWeek: watchedValues.daysOfWeek,
    stackable: watchedValues.stackable,
    exclusiveGroup: watchedValues.exclusiveGroup,
    selectedNames,
  })

  const activeMeta = STEP_META[currentStep]
  const ActiveIcon = activeMeta.icon

  return (
    <form onSubmit={submit} noValidate className="@container/promotion-form flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        {/* Banda de identidad: Nombre + Estado, siempre visible sin
            importar en que paso este el usuario — mismo patron que
            Productos/Categorías/Impuestos (`Switch` en creación,
            `ActiveStatusBadge` de solo lectura en edición). */}
        <div className="flex flex-col gap-4 border-b border-border p-5 @lg/promotion-form:flex-row @lg/promotion-form:items-center">
          <div className="min-w-0 flex-1">
            <Label htmlFor="promotion-form-name">
              Nombre de la promoción
              <RequiredMark />
            </Label>
            <Input
              id="promotion-form-name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              className="h-10 text-lg font-semibold"
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2.5 self-start rounded-lg border border-input bg-card px-3.5 py-2.5 @lg/promotion-form:self-auto">
            {mode === 'create' ? (
              <>
                <Label htmlFor="promotion-form-active" className="text-sm">
                  Activar al guardar
                </Label>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Switch
                      id="promotion-form-active"
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
                <ActiveStatusBadge active={currentStatus ?? true} />
              </>
            )}
          </div>
        </div>

        {/* Workspace de 3 columnas: riel de pasos | paso activo (ocupa casi
            toda el area) | panel lateral de simulacion comercial, siempre
            visible — mismos 3 bloques de siempre, ahora como columnas de
            una unica superficie (divisores internos, no tarjetas sueltas). */}
        <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-[224px_1fr_320px] lg:items-start lg:divide-x lg:divide-y-0">
          <PromotionStepRail steps={steps} currentStep={currentStep} onSelect={setCurrentStep} />

          <div className="flex min-h-[60vh] flex-col gap-5 p-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <ActiveIcon className="size-5 text-brand" />
              <div>
              <p className="text-base font-bold text-foreground">{activeMeta.title}</p>
              <p className="text-sm text-muted-foreground">{activeMeta.description}</p>
            </div>
          </div>

          {currentStep === 'origin' && (
            <div className="flex flex-col gap-4">
              <PromotionOriginFields control={control} isSubmitting={isSubmitting} />

              {isSupplierMandated && (
                <p className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-brand">
                  Vas a poder elegir el proveedor y su financiamiento en el paso "Financiamiento".
                </p>
              )}

              <div className="flex flex-col gap-1 border-t border-border pt-4">
                <Label htmlFor="promotion-form-description">Descripción (opcional)</Label>
                <textarea
                  id="promotion-form-description"
                  rows={2}
                  disabled={isSubmitting}
                  placeholder="Detalle interno de la promoción..."
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...register('description', { setValueAs: emptyToUndefined })}
                />
              </div>
            </div>
          )}

          {currentStep === 'scope' && (
            <ScopeCards
              control={control}
              errors={errors}
              isSubmitting={isSubmitting}
              products={products}
              categories={categories}
              selectedProducts={selectedProducts}
              onToggleProduct={toggleProduct}
              onUpdateRequiredQuantity={updateRequiredQuantity}
              selectedCategoryIds={selectedCategoryIds}
              onToggleCategory={toggleCategory}
            />
          )}

          {currentStep === 'effect' && (
            <EffectCards
              control={control}
              register={register}
              errors={errors}
              isSubmitting={isSubmitting}
              referenceProduct={referenceProduct}
            />
          )}

          {currentStep === 'conditions' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <Label htmlFor="promotion-form-minQuantity">
                  Cantidad/peso mínimo para que aplique (opcional)
                </Label>
                <Input
                  id="promotion-form-minQuantity"
                  type="number"
                  min={0}
                  step="0.001"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.minQuantity}
                  className="max-w-52"
                  {...register('minQuantity', { setValueAs: emptyToUndefinedNumber })}
                />
                {errors.minQuantity && (
                  <p className="text-sm text-destructive">{errors.minQuantity.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-4 border-t border-border pt-5">
                <VigenciaSection
                  register={register}
                  errors={errors}
                  setValue={setValue}
                  isSubmitting={isSubmitting}
                  initialEnabled={hasInitialVigencia}
                />
              </div>
            </div>
          )}

          {currentStep === 'combination' && (
            <PromotionCompatibilityFields register={register} errors={errors} isSubmitting={isSubmitting} />
          )}

          {currentStep === 'funding' && (
            <PromotionFundingFields
              control={control}
              register={register}
              setValue={setValue}
              errors={errors}
              isSubmitting={isSubmitting}
              initialSupplier={initialSupplier}
            />
          )}

          {currentStep === 'review' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 rounded-lg border border-brand/15 bg-brand/5 p-4">
                <p className="text-xs font-semibold tracking-wide text-brand/70 uppercase">
                  Así queda la promoción
                </p>
                {narrativeSentences.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 text-sm text-foreground">
                    {narrativeSentences.map((sentence) => (
                      <li key={sentence}>{sentence}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Completá el alcance y el beneficio para ver el resumen.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                El estado (activa/inactiva) se define arriba, junto al nombre. La simulación
                comercial y de rentabilidad completa está siempre visible en el panel de la derecha.
              </p>
            </div>
          )}
          </div>

          <div className="p-5 lg:sticky lg:top-4">
            <PromotionLivePanel
              name={watchedValues.name}
              scopeType={watchedValues.scopeType}
              hasScopeSelection={hasScopeSelection}
              selectedNames={selectedNames}
              effectType={watchedValues.effectType}
              effectValue={watchedValues.effectValue}
              buyQuantity={watchedValues.buyQuantity}
              payQuantity={watchedValues.payQuantity}
              minQuantity={watchedValues.minQuantity}
              referenceProduct={referenceProduct}
              fundingType={watchedValues.fundingType}
              supplierSubsidyValue={watchedValues.supplierSubsidyValue}
              supplierId={watchedValues.supplierId}
              commercialOrigin={watchedValues.commercialOrigin}
              isActive={isActive}
            />
          </div>
        </div>

        {/* Pie — Cancelar/Guardar, mismo lugar que el resto del ERP
            (antes vivian en la barra superior). */}
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
