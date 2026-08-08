/**
 * config/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion de la configuracion de la aplicacion.
 */
export { env, isProduction, isDevelopment, isTest, resolveTrustProxy } from './env';
export type { Env } from './env';
export { databaseConfig, transactionConfig } from './database';
export { RATE_LIMIT_POLICIES } from './rateLimitPolicies';
export type { RateLimitCategory, RateLimitPolicy } from './rateLimitPolicies';
export {
  PRODUCT_IMAGES_URL_PREFIX,
  PRODUCT_IMAGES_STORAGE_DIR,
  PRODUCT_IMAGES_CACHE_MAX_AGE,
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  PRODUCT_IMAGE_MAX_SIZE_MB,
  PRODUCT_IMAGE_MAX_SIZE_BYTES,
  buildProductImageUrl,
  withImageCacheBusting,
  extensionForMimeType,
} from './productImages';
export type { ProductImageMimeType } from './productImages';
export { jwtConfig } from './jwt';
export { corsConfig } from './cors';
export { logger } from './logger';
export type { Logger } from './logger';
