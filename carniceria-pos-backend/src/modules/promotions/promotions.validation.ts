/**
 * modules/promotions/promotions.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de Promociones (Bloque P.3).
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `promotions.service.ts`). Sin logica de
 * aplicacion/calculo de promociones — solo valida la FORMA del catalogo.
 */
import { z } from 'zod';

const PromotionScopeTypeSchema = z.enum(['PRODUCT', 'CATEGORY', 'COMBO', 'CART']);
const PromotionEffectTypeSchema = z.enum([
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'SPECIAL_PRICE',
  'FIXED_PRICE',
  'BUY_X_PAY_Y',
]);
const DayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

// PROMO-05 (Commercial Pricing Engine, validacion): enums de PROMO-03.
const PromotionOriginSchema = z.enum(['INTERNAL', 'SUPPLIER_MANDATED']);
const PromotionFundingTypeSchema = z.enum([
  'NONE',
  'SUPPLIER_SUBSIDY_PER_UNIT',
  'SUPPLIER_SUBSIDY_PERCENTAGE',
]);

/** Formato "HH:mm" (24 horas) — mismo formato que el `<input type="time">`
 * HTML nativo, para no exigir ninguna conversion en el formulario del
 * frontend. */
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const PromotionProductInputSchema = z.object({
  productId: z.string().uuid('El producto debe ser un identificador válido.'),
  // Solo se usa cuando la promocion es un combo (`scopeType: COMBO`); se
  // ignora para `scopeType: PRODUCT` (validado mas abajo).
  requiredQuantity: z
    .number()
    .positive('La cantidad requerida debe ser mayor a 0.')
    .nullish(),
});

/** Validacion del cuerpo de la peticion de creacion de promocion. Las
 * reglas cruzadas (que campos son obligatorios segun `scopeType`/
 * `effectType`) se validan con `.refine()`, mismo criterio ya usado en
 * `sales/validation.ts` (`CreateSaleSchema`, referencia de pago segun
 * metodo de pago). */
export const CreatePromotionSchema = z
  .object({
    name: z
      .string({ required_error: 'El nombre de la promoción es obligatorio.' })
      .trim()
      .min(3, 'El nombre de la promoción debe tener al menos 3 caracteres.'),
    description: z.string().trim().nullish(),
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
    startDate: z.coerce.date().nullish(),
    endDate: z.coerce.date().nullish(),
    startTime: z.string().regex(TIME_REGEX, 'La hora de inicio debe tener formato HH:mm.').nullish(),
    endTime: z.string().regex(TIME_REGEX, 'La hora de fin debe tener formato HH:mm.').nullish(),
    daysOfWeek: z.array(DayOfWeekSchema).optional(),
    priority: z.number().int().min(0, 'La prioridad no puede ser negativa.').optional(),
    stackable: z.boolean().optional(),
    exclusiveGroup: z.string().trim().nullish(),
    active: z.boolean().optional(),
    sucursalId: z.string().uuid('La sucursal debe ser un identificador válido.').nullish(),
    // PROMO-05: ver reglas de coherencia en los `.refine()` de mas abajo.
    supplierId: z.string().uuid('El proveedor debe ser un identificador válido.').nullish(),
    commercialOrigin: PromotionOriginSchema.optional(),
    fundingType: PromotionFundingTypeSchema.optional(),
    supplierSubsidyValue: z
      .number()
      .positive('El valor del subsidio debe ser mayor a 0.')
      .nullish(),
    productIds: z.array(PromotionProductInputSchema).optional(),
    categoryIds: z.array(z.string().uuid('La categoría debe ser un identificador válido.')).optional(),
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
  // PROMO-13: precio fijo POR UNIDAD, solo tiene sentido de negocio
  // aplicado a un producto puntual o a una categoria — `CART` forzaria el
  // mismo precio unitario a productos distintos del carrito (sin
  // relacion entre si) y `COMBO` ya tiene su propio mecanismo de precio
  // total fijo (`SPECIAL_PRICE`). La MISMA regla se re-valida en
  // `promotions.service.ts::assertFixedPriceScope` sobre el estado FINAL
  // (creacion o, en edicion, el resultado de fusionar el DTO con la
  // promocion existente) — mismo criterio ya establecido por
  // `assertCommercialCoherence` para los campos comerciales de PROMO-05.
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
  // PROMO-05 (Commercial Pricing Engine, reglas de coherencia comercial):
  // las mismas 4 reglas se re-validan en `promotions.service.ts` sobre el
  // estado FINAL (creacion o, en edicion, el resultado de fusionar el DTO
  // con la promocion existente) — aca solo cubren el caso en que el
  // cliente ya envio ambos campos relacionados en la misma peticion.
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
  // PROMO-12: mismo criterio que el `.refine()` de arriba (origen), pero
  // independiente — un financiamiento externo sin saber que proveedor lo
  // otorga es un estado inconsistente aunque el origen sea `INTERNAL`
  // (hallazgo #2 de la auditoria PROMO-11).
  .refine(
    (data) => (data.fundingType ?? 'NONE') === 'NONE' || Boolean(data.supplierId),
    {
      message: 'Debe indicar el proveedor cuando la promoción tiene financiamiento externo.',
      path: ['supplierId'],
    },
  );

export type CreatePromotionDto = z.infer<typeof CreatePromotionSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de promocion.
 * Mismos campos que `CreatePromotionSchema`, todos opcionales — sin las
 * reglas cruzadas de creacion (mismo criterio que `UpdateTaxSchema`/
 * `UpdateSaleSchema`, que tampoco las repiten): la actualizacion parcial
 * no necesariamente reenvia el objeto completo, asi que exigir de nuevo
 * "productIds obligatorio si scopeType es PRODUCT" rompería una
 * actualizacion que solo cambia, por ejemplo, `priority`. `active` no
 * forma parte de este schema — el cambio de estado tiene su propio
 * endpoint (`ChangePromotionStatusSchema`), igual que en Impuestos. */
export const UpdatePromotionSchema = z.object({
  name: z.string().trim().min(3, 'El nombre de la promoción debe tener al menos 3 caracteres.').optional(),
  description: z.string().trim().nullish(),
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
  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
  startTime: z.string().regex(TIME_REGEX, 'La hora de inicio debe tener formato HH:mm.').nullish(),
  endTime: z.string().regex(TIME_REGEX, 'La hora de fin debe tener formato HH:mm.').nullish(),
  daysOfWeek: z.array(DayOfWeekSchema).optional(),
  priority: z.number().int().min(0, 'La prioridad no puede ser negativa.').optional(),
  stackable: z.boolean().optional(),
  exclusiveGroup: z.string().trim().nullish(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador válido.').nullish(),
  // PROMO-05: mismos campos que `CreatePromotionSchema`, sin los
  // `.refine()` cruzados (mismo criterio ya aplicado al resto del
  // schema de actualizacion — una edicion parcial no necesariamente
  // reenvia ambos campos relacionados a la vez, ej. cambiar solo
  // `priority` no deberia exigir `supplierSubsidyValue`). La coherencia
  // final (contra el estado YA fusionado con la promocion existente) se
  // valida en `promotions.service.ts`.
  supplierId: z.string().uuid('El proveedor debe ser un identificador válido.').nullish(),
  commercialOrigin: PromotionOriginSchema.optional(),
  fundingType: PromotionFundingTypeSchema.optional(),
  supplierSubsidyValue: z
    .number()
    .positive('El valor del subsidio debe ser mayor a 0.')
    .nullish(),
  productIds: z.array(PromotionProductInputSchema).optional(),
  categoryIds: z.array(z.string().uuid('La categoría debe ser un identificador válido.')).optional(),
});

export type UpdatePromotionDto = z.infer<typeof UpdatePromotionSchema>;

/** Validacion de los query params para el listado de promociones. */
export const ListPromotionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  scopeType: PromotionScopeTypeSchema.optional(),
  search: z.string().optional(),
});

export type ListPromotionsQueryDto = z.infer<typeof ListPromotionsQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de promocion. */
export const ChangePromotionStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangePromotionStatusDto = z.infer<typeof ChangePromotionStatusSchema>;
