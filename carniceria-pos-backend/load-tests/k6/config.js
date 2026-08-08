/**
 * load-tests/k6/config.js
 * -----------------------------------------------------------------------------
 * Configuracion compartida por todos los escenarios de k6 (Fase 15, Bloque D).
 * Nada de este directorio se importa desde el codigo de la aplicacion — es
 * infraestructura de prueba, aislada del backend real.
 *
 * Variables de entorno esperadas (todas con default de desarrollo local):
 *   BASE_URL   - URL base de la API (incluye el prefijo /api/v1)
 *   ADMIN_USER - usuario ya sembrado por `prisma/seed.ts` (rol ADMIN)
 *   ADMIN_PASS - password de ese usuario (= SEED_ADMIN_PASSWORD del .env)
 *   PRODUCT_SKU - SKU de un producto ya sembrado por `prisma/seed.ts`
 *   SUPPLIER_INDEX - indice (0-based) del proveedor a usar en /suppliers
 *
 * IMPORTANTE (ver docs/LOAD_TESTING.md, seccion de riesgos): estas pruebas
 * DEBEN correr contra una base de datos dedicada a pruebas de carga, nunca
 * contra la base de produccion ni siquiera contra la de desarrollo con datos
 * reales del negocio — generan cientos/miles de filas de Sale/Purchase.
 */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1'

export const ADMIN_USER = __ENV.ADMIN_USER || 'admin'
export const ADMIN_PASS = __ENV.ADMIN_PASS || 'Admin123!'

export const PRODUCT_SKU = __ENV.PRODUCT_SKU || 'RES-001'
export const SUPPLIER_INDEX = Number(__ENV.SUPPLIER_INDEX || 0)

export const JSON_HEADERS = { 'Content-Type': 'application/json' }
