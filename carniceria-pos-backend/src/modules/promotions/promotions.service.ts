/**
 * modules/promotions/promotions.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de Promociones (Bloque P.3, catalogo
 * administrativo).
 *
 * Responsabilidades:
 *  - Validar existencia de la promocion antes de leer/actualizar/cambiar su
 *    estado.
 *  - Validar que los productos/categorias/sucursal referenciados existan
 *    antes de asociarlos a una promocion.
 *  - Traducir entre el formato "HH:mm" que expone el modulo hacia afuera
 *    (`startTime`/`endTime`) y el `Date` que exige Prisma para una columna
 *    `@db.Time` — unica conversion de formato de este servicio, sin ningun
 *    calculo de negocio.
 *  - Traducir los registros de Prisma a la forma publica `PromotionResponse`.
 *
 * LO QUE ESTE SERVICIO DELIBERADAMENTE NO HACE (ver analisis de
 * arquitectura aprobado): no evalua si una promocion aplica a una venta, no
 * calcula ningun descuento, no se integra con `sales/service.ts` ni con el
 * POS. Es CRUD de catalogo — la unica logica es de validacion de forma y
 * de integridad referencial. El motor de reglas que consuma este catalogo
 * es un bloque futuro, separado.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `promotions.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@/shared/errors';
import * as promotionsRepository from './promotions.repository';
import { formatTimeString, parseTimeString } from './promotionTime.utils';
import type {
  ChangePromotionStatusDto,
  CreatePromotionDto,
  ListPromotionsQuery,
  ListPromotionsResult,
  PromotionEffectType,
  PromotionFundingType,
  PromotionOrigin,
  PromotionResponse,
  PromotionScopeType,
  UpdatePromotionDto,
} from './promotions.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type PromotionRecord = {
  id: string;
  name: string;
  description: string | null;
  scopeType: string;
  effectType: string;
  effectValue: Prisma.Decimal | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  minQuantity: Prisma.Decimal | null;
  startDate: Date | null;
  endDate: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  daysOfWeek: string[];
  priority: number;
  stackable: boolean;
  exclusiveGroup: string | null;
  active: boolean;
  sucursalId: string | null;
  sucursal: { id: string; name: string } | null;
  // PROMO-03/05 (Commercial Pricing Engine).
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  commercialOrigin: string;
  fundingType: string;
  supplierSubsidyValue: Prisma.Decimal | null;
  products: {
    productId: string;
    requiredQuantity: Prisma.Decimal | null;
    product: { id: string; name: string; sku: string | null };
  }[];
  categories: { categoryId: string; category: { id: string; name: string } }[];
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica de la promocion. */
function toPromotionResponse(promotion: PromotionRecord): PromotionResponse {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    scopeType: promotion.scopeType as PromotionResponse['scopeType'],
    effectType: promotion.effectType as PromotionResponse['effectType'],
    effectValue: promotion.effectValue ? Number(promotion.effectValue) : null,
    buyQuantity: promotion.buyQuantity,
    payQuantity: promotion.payQuantity,
    minQuantity: promotion.minQuantity ? Number(promotion.minQuantity) : null,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    startTime: promotion.startTime ? formatTimeString(promotion.startTime) : null,
    endTime: promotion.endTime ? formatTimeString(promotion.endTime) : null,
    daysOfWeek: promotion.daysOfWeek as PromotionResponse['daysOfWeek'],
    priority: promotion.priority,
    stackable: promotion.stackable,
    exclusiveGroup: promotion.exclusiveGroup,
    active: promotion.active,
    sucursalId: promotion.sucursalId,
    sucursal: promotion.sucursal,
    supplierId: promotion.supplierId,
    supplier: promotion.supplier,
    commercialOrigin: promotion.commercialOrigin as PromotionResponse['commercialOrigin'],
    fundingType: promotion.fundingType as PromotionResponse['fundingType'],
    supplierSubsidyValue: promotion.supplierSubsidyValue ? Number(promotion.supplierSubsidyValue) : null,
    products: promotion.products.map((item) => ({
      productId: item.productId,
      requiredQuantity: item.requiredQuantity ? Number(item.requiredQuantity) : null,
      product: item.product,
    })),
    categories: promotion.categories.map((item) => ({
      categoryId: item.categoryId,
      category: item.category,
    })),
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  };
}

/** Valida que los productos/categorias/sucursal referenciados por el DTO
 * existan realmente — integridad referencial, no logica de aplicacion de
 * promociones (eso no existe en este bloque). Compartida por `create`/
 * `update`. */
async function assertReferencesExist(
  dto: Pick<
    CreatePromotionDto | UpdatePromotionDto,
    'productIds' | 'categoryIds' | 'sucursalId' | 'supplierId'
  >,
): Promise<void> {
  if (dto.productIds && dto.productIds.length > 0) {
    const ids = dto.productIds.map((item) => item.productId);
    const products = await promotionsRepository.findProductsByIds(ids);
    const missingId = ids.find((id) => !products.some((product) => product.id === id));

    if (missingId) {
      throw new NotFoundError('Producto');
    }
  }

  if (dto.categoryIds && dto.categoryIds.length > 0) {
    const categories = await promotionsRepository.findCategoriesByIds(dto.categoryIds);
    const missingId = dto.categoryIds.find((id) => !categories.some((category) => category.id === id));

    if (missingId) {
      throw new NotFoundError('Categoría');
    }
  }

  if (dto.sucursalId) {
    const sucursal = await promotionsRepository.findSucursalById(dto.sucursalId);

    if (!sucursal) {
      throw new NotFoundError('Sucursal');
    }
  }

  // PROMO-05: mismo criterio que `sucursalId` arriba.
  if (dto.supplierId) {
    const supplier = await promotionsRepository.findSupplierById(dto.supplierId);

    if (!supplier) {
      throw new NotFoundError('Proveedor');
    }
  }
}

/**
 * PROMO-05 (Commercial Pricing Engine, reglas de coherencia comercial):
 * valida el estado FINAL de los 4 campos comerciales entre si — nunca el
 * DTO parcial tal cual llega (ver `update()`, que primero lo fusiona con
 * la promocion existente). Reglas:
 *  1. `fundingType: NONE` => `supplierSubsidyValue` debe estar vacio.
 *  2. `fundingType !== NONE` => `supplierSubsidyValue` es obligatorio.
 *  3. `fundingType: SUPPLIER_SUBSIDY_PERCENTAGE` => `supplierSubsidyValue`
 *     no puede superar 100 (mismo criterio que `effectValue` con
 *     `effectType: PERCENTAGE`).
 *  4. `commercialOrigin: SUPPLIER_MANDATED` => `supplierId` es
 *     obligatorio (una condicion "impuesta por el proveedor" sin saber
 *     cual proveedor es un estado inconsistente).
 * Las mismas 4 reglas ya se validan en `promotions.validation.ts` para
 * `CreatePromotionSchema` (cuando el cliente envia ambos campos
 * relacionados en la misma peticion) — esta funcion es la que realmente
 * garantiza la invariante, porque tambien corre en `update()` sobre el
 * estado fusionado, cubriendo actualizaciones parciales que el schema de
 * Zod deliberadamente no puede validar por si solo.
 */
function assertCommercialCoherence(data: {
  commercialOrigin: PromotionOrigin;
  fundingType: PromotionFundingType;
  supplierId: string | null;
  supplierSubsidyValue: number | null;
}): void {
  if (data.fundingType === 'NONE' && data.supplierSubsidyValue != null) {
    throw new ValidationError(
      'El valor del subsidio debe estar vacío cuando la promoción no tiene financiamiento del proveedor.',
    );
  }

  if (data.fundingType !== 'NONE' && data.supplierSubsidyValue == null) {
    throw new ValidationError('Debe indicar el valor del subsidio para este tipo de financiamiento.');
  }

  if (
    data.fundingType === 'SUPPLIER_SUBSIDY_PERCENTAGE' &&
    data.supplierSubsidyValue != null &&
    data.supplierSubsidyValue > 100
  ) {
    throw new ValidationError('El porcentaje de subsidio del proveedor no puede ser mayor a 100.');
  }

  if (data.commercialOrigin === 'SUPPLIER_MANDATED' && !data.supplierId) {
    throw new ValidationError(
      'Debe indicar el proveedor cuando el origen comercial es una condición impuesta por el proveedor.',
    );
  }

  // PROMO-12: un financiamiento externo sin saber que proveedor lo otorga
  // es un estado inconsistente (un subsidio "de nadie en particular") —
  // hallazgo #2 de la auditoria PROMO-11. Regla independiente de la de
  // `commercialOrigin` de arriba: aunque el origen sea `INTERNAL` (una
  // promocion propia del negocio), si tiene financiamiento externo debe
  // saberse quien lo financia.
  if (data.fundingType !== 'NONE' && !data.supplierId) {
    throw new ValidationError(
      'Debe indicar el proveedor cuando la promoción tiene financiamiento externo.',
    );
  }
}

/**
 * PROMO-13 (nuevo efecto `FIXED_PRICE`, precio fijo POR UNIDAD): valida
 * el estado FINAL de `effectType`/`scopeType` entre si — mismo criterio
 * que `assertCommercialCoherence` (nunca el DTO parcial tal cual llega,
 * `update()` primero lo fusiona con la promocion existente). La MISMA
 * regla ya se valida en `promotions.validation.ts::CreatePromotionSchema`
 * (cuando el cliente envia ambos campos en la misma peticion) — esta
 * funcion es la que realmente garantiza la invariante en `update()`,
 * cubriendo actualizaciones parciales que el schema de Zod
 * deliberadamente no puede validar por si solo (ej. cambiar solo
 * `scopeType` de una promocion `FIXED_PRICE` ya existente a `CART`).
 *
 * Un precio fijo por unidad no tiene sentido de negocio para `CART`
 * (forzaria el mismo precio unitario a productos distintos del carrito,
 * sin relacion entre si) ni para `COMBO` (que ya tiene su propio
 * mecanismo de precio TOTAL fijo, `SPECIAL_PRICE`) — ver analisis
 * aprobado de PROMO-13.
 */
function assertFixedPriceScope(data: {
  effectType: PromotionEffectType;
  scopeType: PromotionScopeType;
}): void {
  if (data.effectType === 'FIXED_PRICE' && data.scopeType !== 'PRODUCT' && data.scopeType !== 'CATEGORY') {
    throw new ValidationError('El precio fijo solo puede aplicarse a un producto o una categoría.');
  }
}

export async function create(dto: CreatePromotionDto): Promise<PromotionResponse> {
  await assertReferencesExist(dto);

  assertFixedPriceScope({ effectType: dto.effectType, scopeType: dto.scopeType });

  // PROMO-05: se resuelven los defaults ANTES de validar coherencia —
  // mismo criterio que `priority ?? 0`/`stackable ?? false` mas abajo,
  // pero acá el resultado tambien alimenta `assertCommercialCoherence`.
  const commercialOrigin: PromotionOrigin = dto.commercialOrigin ?? 'INTERNAL';
  const fundingType: PromotionFundingType = dto.fundingType ?? 'NONE';
  const supplierId = dto.supplierId ?? null;
  const supplierSubsidyValue = dto.supplierSubsidyValue ?? null;

  assertCommercialCoherence({ commercialOrigin, fundingType, supplierId, supplierSubsidyValue });

  const created = await promotionsRepository.create(
    {
      name: dto.name,
      description: dto.description ?? null,
      scopeType: dto.scopeType,
      effectType: dto.effectType,
      effectValue: dto.effectValue ?? null,
      buyQuantity: dto.buyQuantity ?? null,
      payQuantity: dto.payQuantity ?? null,
      minQuantity: dto.minQuantity ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      startTime: dto.startTime ? parseTimeString(dto.startTime) : null,
      endTime: dto.endTime ? parseTimeString(dto.endTime) : null,
      daysOfWeek: dto.daysOfWeek ?? [],
      priority: dto.priority ?? 0,
      stackable: dto.stackable ?? false,
      exclusiveGroup: dto.exclusiveGroup ?? null,
      active: dto.active ?? true,
      sucursalId: dto.sucursalId ?? null,
      supplierId,
      commercialOrigin,
      fundingType,
      supplierSubsidyValue,
    },
    (dto.productIds ?? []).map((item) => ({
      productId: item.productId,
      requiredQuantity: item.requiredQuantity ?? null,
    })),
    (dto.categoryIds ?? []).map((categoryId) => ({ categoryId })),
  );

  return toPromotionResponse(created);
}

export async function findById(id: string): Promise<PromotionResponse> {
  const promotion = await promotionsRepository.findById(id);

  if (!promotion) {
    throw new NotFoundError('Promoción');
  }

  return toPromotionResponse(promotion);
}

export async function findMany(query: ListPromotionsQuery): Promise<ListPromotionsResult> {
  const [items, total] = await promotionsRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toPromotionResponse(item)),
    total,
  };
}

export async function update(id: string, dto: UpdatePromotionDto): Promise<PromotionResponse> {
  const existing = await promotionsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Promoción');
  }

  await assertReferencesExist(dto);

  // PROMO-13: mismo criterio que la coherencia comercial de abajo — se
  // valida sobre el estado FINAL (`effectType`/`scopeType` fusionados con
  // la promocion existente), para cubrir tambien una edicion que solo
  // cambia UNO de los dos campos (ej. cambiar el `scopeType` de una
  // promocion `FIXED_PRICE` ya existente a `CART`, sin reenviar
  // `effectType`).
  assertFixedPriceScope({
    effectType: (dto.effectType ?? (existing.effectType as PromotionEffectType)) as PromotionEffectType,
    scopeType: (dto.scopeType ?? (existing.scopeType as PromotionScopeType)) as PromotionScopeType,
  });

  // PROMO-05: la coherencia se valida sobre el estado FINAL (DTO
  // fusionado con la promocion existente), no sobre el DTO parcial tal
  // cual llega — una actualizacion que solo cambia `priority`, por
  // ejemplo, no debe fallar porque no reenvio `fundingType`/
  // `supplierSubsidyValue`; deben seguir siendo coherentes CONTRA los
  // valores que la promocion ya tenia.
  const resolvedCommercialOrigin: PromotionOrigin =
    dto.commercialOrigin ?? (existing.commercialOrigin as PromotionOrigin);
  const resolvedFundingType: PromotionFundingType =
    dto.fundingType ?? (existing.fundingType as PromotionFundingType);
  const resolvedSupplierId = dto.supplierId !== undefined ? dto.supplierId : existing.supplierId;
  const resolvedSupplierSubsidyValue =
    dto.supplierSubsidyValue !== undefined
      ? dto.supplierSubsidyValue
      : existing.supplierSubsidyValue != null
        ? Number(existing.supplierSubsidyValue)
        : null;

  assertCommercialCoherence({
    commercialOrigin: resolvedCommercialOrigin,
    fundingType: resolvedFundingType,
    supplierId: resolvedSupplierId,
    supplierSubsidyValue: resolvedSupplierSubsidyValue,
  });

  const updated = await promotionsRepository.update(
    id,
    {
      name: dto.name,
      description: dto.description,
      scopeType: dto.scopeType,
      effectType: dto.effectType,
      effectValue: dto.effectValue,
      buyQuantity: dto.buyQuantity,
      payQuantity: dto.payQuantity,
      minQuantity: dto.minQuantity,
      startDate: dto.startDate,
      endDate: dto.endDate,
      startTime: dto.startTime !== undefined ? (dto.startTime ? parseTimeString(dto.startTime) : null) : undefined,
      endTime: dto.endTime !== undefined ? (dto.endTime ? parseTimeString(dto.endTime) : null) : undefined,
      daysOfWeek: dto.daysOfWeek,
      priority: dto.priority,
      stackable: dto.stackable,
      exclusiveGroup: dto.exclusiveGroup,
      sucursalId: dto.sucursalId,
      supplierId: dto.supplierId,
      commercialOrigin: dto.commercialOrigin,
      fundingType: dto.fundingType,
      supplierSubsidyValue: dto.supplierSubsidyValue,
    },
    dto.productIds?.map((item) => ({
      productId: item.productId,
      requiredQuantity: item.requiredQuantity ?? null,
    })),
    dto.categoryIds?.map((categoryId) => ({ categoryId })),
  );

  return toPromotionResponse(updated);
}

export async function changeStatus(
  id: string,
  dto: ChangePromotionStatusDto,
): Promise<PromotionResponse> {
  const existing = await promotionsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Promoción');
  }

  const updated = await promotionsRepository.changeStatus(id, dto.active);

  return toPromotionResponse(updated);
}

/**
 * Borrado logico de una promocion. Idempotente por diseño: no distingue
 * "nunca existio" de "ya fue borrada" -- ambos casos devuelven
 * `NotFoundError`, porque `findById` ya pasa por el filtro global de
 * `deletedAt` (via la extension `softDelete.ext.ts`, con `Promotion` ya
 * registrado en `SOFT_DELETE_MODELS`). Mismo criterio que
 * `categories/categories.service.ts::remove`.
 *
 * A diferencia de Categorias/Impuestos, aca NO hay ninguna relacion que
 * bloquee el borrado: `PromotionProduct`/`PromotionCategory` son lineas
 * PROPIAS de la promocion (`onDelete: Cascade` en `schema.prisma`, no una
 * dependencia externa), y `SaleAppliedPromotion.promotionId` es nullable
 * con `onDelete: SetNull` — el schema ya esta diseñado para que una venta
 * historica sobreviva la eliminacion de la promocion que aplico (conserva
 * `promotionNameSnapshot`). Por eso `remove` no tiene ningun chequeo de
 * conteo antes del borrado logico.
 */
export async function remove(id: string): Promise<void> {
  const existing = await promotionsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Promoción');
  }

  await promotionsRepository.softDelete(id);
}
