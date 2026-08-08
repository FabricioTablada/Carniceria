/**
 * modules/promotions/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de Promociones (Bloque P.3).
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`promotions.controller.ts`, `promotions.service.ts`, etc.) directamente.
 */
export { promotionsRoutes } from './promotions.routes';
export {
  create as createPromotionController,
  findById as findByIdPromotionController,
  findMany as findManyPromotionsController,
  update as updatePromotionController,
  changeStatus as changePromotionStatusController,
  remove as removePromotionController,
} from './promotions.controller';
export {
  create as createPromotionService,
  findById as findByIdPromotionService,
  findMany as findManyPromotionsService,
  update as updatePromotionService,
  changeStatus as changePromotionStatusService,
  remove as removePromotionService,
} from './promotions.service';
export {
  ChangePromotionStatusSchema,
  CreatePromotionSchema,
  ListPromotionsQuerySchema,
  UpdatePromotionSchema,
} from './promotions.validation';
export type {
  ChangePromotionStatusDto as ChangePromotionStatusValidationDto,
  CreatePromotionDto as CreatePromotionValidationDto,
  ListPromotionsQueryDto,
  UpdatePromotionDto as UpdatePromotionValidationDto,
} from './promotions.validation';
export type {
  ChangePromotionStatusDto,
  CreatePromotionDto,
  DayOfWeek,
  ListPromotionsFilters,
  ListPromotionsQuery,
  ListPromotionsResult,
  PromotionEffectType,
  PromotionResponse,
  PromotionScopeType,
  UpdatePromotionDto,
} from './promotions.types';
// Bloque P.5 (PromotionApplicationService — capa adaptadora hacia el
// Motor de Reglas). Sin consumidores todavia: ni `sales/service.ts`, ni
// el POS, ni ningun endpoint la invocan en este bloque.
export { evaluateSalePromotions } from './promotionApplication.service';
export type {
  PromotionApplicationAppliedPromotion,
  PromotionApplicationCartLine,
  PromotionApplicationContext,
  PromotionApplicationLineResult,
  PromotionApplicationResult,
  PromotionApplicationTotals,
} from './promotionApplication.types';
