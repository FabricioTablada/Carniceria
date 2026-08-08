import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type { CreatePromotionDto, UpdatePromotionDto } from '../types/promotion.types'

/**
 * features/promotions/schemas/promotion.schema.ts
 * -----------------------------------------------------------------------------
 * Replica exacta de `CreatePromotionSchema`/`UpdatePromotionSchema`
 * (modules/promotions/promotions.validation.ts, backend). Mismos campos,
 * mismas reglas cruzadas, mismos mensajes. `productId`/`categoryId`/
 * `sucursalId` usan `UUID_REGEX` (`@/lib/validation`) en vez de `.uuid()`
 * nativo de Zod — mismo criterio ya aplicado en todo el proyecto tras el
 * QA critico de mermas (Zod v4 frontend vs Zod v3 backend).
 */

const PromotionScopeTypeSchema = z.enum(['PRODUCT', 'CATEGORY', 'COMBO', 'CART'])
const PromotionEffectTypeSchema = z.enum([
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'SPECIAL_PRICE',
  'FIXED_PRICE',
  'BUY_X_PAY_Y',
])
const DayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
])

// PROMO-07 (Commercial Pricing Engine, frontend): espejo exacto de los
// enums agregados al backend en PROMO-03/05.
const PromotionOriginSchema = z.enum(['INTERNAL', 'SUPPLIER_MANDATED'])
const PromotionFundingTypeSchema = z.enum([
  'NONE',
  'SUPPLIER_SUBSIDY_PER_UNIT',
  'SUPPLIER_SUBSIDY_PERCENTAGE',
])

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const promotionProductInputSchema = z.object({
  productId: z.string().regex(UUID_REGEX, 'El producto debe ser un identificador válido.'),
  requiredQuantity: z
    .number()
    .positive('La cantidad requerida debe ser mayor a 0.')
    .nullish(),
})

export const createPromotionSchema: z.ZodType<CreatePromotionDto> = z
  .object({
    name: z
      .string()
      .min(1, 'El nombre de la promoción es obligatorio.')
      .min(3, 'El nombre de la promoción debe tener al menos 3 caracteres.'),
    description: z.string().nullish(),
    scopeType: PromotionScopeTypeSchema,
    effectType: PromotionEffectTypeSchema,
    effectValue: z.number().positive('El valor del beneficio debe ser mayor a 0.').nullish(),
    buyQuantity: z
      .number()
      .int('La cantidad a comprar debe ser un número entero.')
      .positive('La cantidad a comprar debe ser mayor a 0.')
      .nullish(),
    payQuantity: z
      .number()
      .int('La cantidad a pagar debe ser un número entero.')
      .positive('La cantidad a pagar debe ser mayor a 0.')
      .nullish(),
    minQuantity: z.number().positive('La cantidad mínima debe ser mayor a 0.').nullish(),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),
    startTime: z.string().regex(TIME_REGEX, 'La hora de inicio debe tener formato HH:mm.').nullish(),
    endTime: z.string().regex(TIME_REGEX, 'La hora de fin debe tener formato HH:mm.').nullish(),
    daysOfWeek: z.array(DayOfWeekSchema).optional(),
    priority: z.number().int().min(0, 'La prioridad no puede ser negativa.').optional(),
    stackable: z.boolean().optional(),
    exclusiveGroup: z.string().nullish(),
    active: z.boolean().optional(),
    sucursalId: z.string().regex(UUID_REGEX, 'La sucursal debe ser un identificador válido.').nullish(),
    // PROMO-07: ver reglas de coherencia en los `.refine()` de mas abajo.
    supplierId: z.string().regex(UUID_REGEX, 'El proveedor debe ser un identificador válido.').nullish(),
    commercialOrigin: PromotionOriginSchema.optional(),
    fundingType: PromotionFundingTypeSchema.optional(),
    supplierSubsidyValue: z
      .number()
      .positive('El valor del subsidio debe ser mayor a 0.')
      .nullish(),
    productIds: z.array(promotionProductInputSchema).optional(),
    categoryIds: z
      .array(z.string().regex(UUID_REGEX, 'La categoría debe ser un identificador válido.'))
      .optional(),
  })
  .refine(
    (data) => data.scopeType !== 'PRODUCT' || Boolean(data.productIds && data.productIds.length > 0),
    {
      message: 'Debe seleccionar al menos un producto para una promoción de alcance "Producto".',
      path: ['productIds'],
    },
  )
  .refine(
    (data) => data.scopeType !== 'COMBO' || Boolean(data.productIds && data.productIds.length > 0),
    {
      message: 'Debe seleccionar al menos un producto para un combo.',
      path: ['productIds'],
    },
  )
  .refine(
    (data) =>
      data.scopeType !== 'COMBO' ||
      (data.productIds ?? []).every((item) => (item.requiredQuantity ?? 0) > 0),
    {
      message: 'Cada producto del combo debe tener una cantidad requerida mayor a 0.',
      path: ['productIds'],
    },
  )
  .refine(
    (data) => data.scopeType !== 'CATEGORY' || Boolean(data.categoryIds && data.categoryIds.length > 0),
    {
      message: 'Debe seleccionar al menos una categoría para una promoción de alcance "Categoría".',
      path: ['categoryIds'],
    },
  )
  .refine(
    (data) =>
      !(['PERCENTAGE', 'FIXED_AMOUNT', 'SPECIAL_PRICE', 'FIXED_PRICE'] as const).includes(
        data.effectType as 'PERCENTAGE' | 'FIXED_AMOUNT' | 'SPECIAL_PRICE' | 'FIXED_PRICE',
      ) || data.effectValue != null,
    {
      message: 'El valor del beneficio es obligatorio para este tipo de beneficio.',
      path: ['effectValue'],
    },
  )
  // PROMO-13: precio fijo POR UNIDAD, solo valido para un producto o una
  // categoría puntual — espejo exacto de la misma regla ya validada en el
  // backend (`promotions.validation.ts`/`promotions.service.ts`, el
  // backend sigue siendo quien realmente la garantiza, incluida la
  // edición parcial que este schema de creación no cubre).
  .refine(
    (data) =>
      data.effectType !== 'FIXED_PRICE' ||
      data.scopeType === 'PRODUCT' ||
      data.scopeType === 'CATEGORY',
    {
      message: 'El precio fijo solo puede aplicarse a un producto o una categoría.',
      path: ['scopeType'],
    },
  )
  .refine(
    (data) => data.effectType !== 'PERCENTAGE' || data.effectValue == null || data.effectValue <= 100,
    {
      message: 'El porcentaje de descuento no puede ser mayor a 100.',
      path: ['effectValue'],
    },
  )
  .refine(
    (data) =>
      data.effectType !== 'BUY_X_PAY_Y' || (data.buyQuantity != null && data.payQuantity != null),
    {
      message: 'Debe indicar cuántas unidades se compran y cuántas se pagan.',
      path: ['buyQuantity'],
    },
  )
  .refine(
    (data) =>
      data.effectType !== 'BUY_X_PAY_Y' ||
      data.buyQuantity == null ||
      data.payQuantity == null ||
      data.payQuantity < data.buyQuantity,
    {
      message: 'La cantidad a pagar debe ser menor a la cantidad a comprar (ej. 2x1: compra 2, paga 1).',
      path: ['payQuantity'],
    },
  )
  .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
    message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin.',
    path: ['endDate'],
  })
  .refine((data) => !data.startTime || !data.endTime || data.startTime <= data.endTime, {
    message: 'La hora de inicio debe ser anterior a la hora de fin.',
    path: ['endTime'],
  })
  // PROMO-07 (Commercial Pricing Engine, reglas de coherencia comercial):
  // espejo exacto de las 4 reglas ya validadas en el backend
  // (`promotions.validation.ts`/`promotions.service.ts`, PROMO-05) — el
  // backend sigue siendo quien realmente garantiza la invariante
  // (incluye el caso de edicion parcial, que este schema de creacion no
  // cubre), esto es solo feedback inmediato en el formulario.
  .refine(
    (data) => (data.fundingType ?? 'NONE') !== 'NONE' || data.supplierSubsidyValue == null,
    {
      message:
        'El valor del subsidio debe estar vacío cuando la promoción no tiene financiamiento del proveedor.',
      path: ['supplierSubsidyValue'],
    },
  )
  .refine(
    (data) => (data.fundingType ?? 'NONE') === 'NONE' || data.supplierSubsidyValue != null,
    {
      message: 'Debe indicar el valor del subsidio para este tipo de financiamiento.',
      path: ['supplierSubsidyValue'],
    },
  )
  .refine(
    (data) =>
      data.fundingType !== 'SUPPLIER_SUBSIDY_PERCENTAGE' ||
      data.supplierSubsidyValue == null ||
      data.supplierSubsidyValue <= 100,
    {
      message: 'El porcentaje de subsidio del proveedor no puede ser mayor a 100.',
      path: ['supplierSubsidyValue'],
    },
  )
  .refine(
    (data) => (data.commercialOrigin ?? 'INTERNAL') !== 'SUPPLIER_MANDATED' || Boolean(data.supplierId),
    {
      message: 'Debe indicar el proveedor cuando el origen comercial es una condición impuesta por el proveedor.',
      path: ['supplierId'],
    },
  )

/**
 * Replica exacta de `UpdatePromotionSchema` (backend): mismos campos que
 * `createPromotionSchema`, todos opcionales, sin las reglas cruzadas de
 * creación (mismo criterio que el backend) y sin `active` (cambio de
 * estado por separado).
 */
export const updatePromotionSchema: z.ZodType<UpdatePromotionDto> = z.object({
  name: z.string().min(3, 'El nombre de la promoción debe tener al menos 3 caracteres.').optional(),
  description: z.string().nullish(),
  scopeType: PromotionScopeTypeSchema.optional(),
  effectType: PromotionEffectTypeSchema.optional(),
  effectValue: z.number().positive('El valor del beneficio debe ser mayor a 0.').nullish(),
  buyQuantity: z
    .number()
    .int('La cantidad a comprar debe ser un número entero.')
    .positive('La cantidad a comprar debe ser mayor a 0.')
    .nullish(),
  payQuantity: z
    .number()
    .int('La cantidad a pagar debe ser un número entero.')
    .positive('La cantidad a pagar debe ser mayor a 0.')
    .nullish(),
  minQuantity: z.number().positive('La cantidad mínima debe ser mayor a 0.').nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  startTime: z.string().regex(TIME_REGEX, 'La hora de inicio debe tener formato HH:mm.').nullish(),
  endTime: z.string().regex(TIME_REGEX, 'La hora de fin debe tener formato HH:mm.').nullish(),
  daysOfWeek: z.array(DayOfWeekSchema).optional(),
  priority: z.number().int().min(0, 'La prioridad no puede ser negativa.').optional(),
  stackable: z.boolean().optional(),
  exclusiveGroup: z.string().nullish(),
  sucursalId: z.string().regex(UUID_REGEX, 'La sucursal debe ser un identificador válido.').nullish(),
  // PROMO-07: mismos campos que `createPromotionSchema`, sin los
  // `.refine()` cruzados — mismo criterio ya aplicado al resto de este
  // schema de actualizacion (edicion parcial). El backend valida la
  // coherencia final contra el estado ya fusionado (PROMO-05).
  supplierId: z.string().regex(UUID_REGEX, 'El proveedor debe ser un identificador válido.').nullish(),
  commercialOrigin: PromotionOriginSchema.optional(),
  fundingType: PromotionFundingTypeSchema.optional(),
  supplierSubsidyValue: z
    .number()
    .positive('El valor del subsidio debe ser mayor a 0.')
    .nullish(),
  productIds: z.array(promotionProductInputSchema).optional(),
  categoryIds: z
    .array(z.string().regex(UUID_REGEX, 'La categoría debe ser un identificador válido.'))
    .optional(),
})
