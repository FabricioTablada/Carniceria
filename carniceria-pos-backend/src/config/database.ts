/**
 * config/database.ts
 * -----------------------------------------------------------------------------
 * Configuracion derivada de la conexion a PostgreSQL.
 *
 * Prisma consume DATABASE_URL directamente. Aqui exponemos ademas parametros
 * utiles a nivel de aplicacion (p.ej. logs de queries en desarrollo) para no
 * dispersar decisiones de infraestructura por el codigo.
 */
import { env, isDevelopment } from './env';

export const databaseConfig = {
  url: env.DATABASE_URL,
  /** Niveles de log de Prisma segun el entorno. */
  prismaLogLevels: isDevelopment
    ? (['query', 'warn', 'error'] as const)
    : (['warn', 'error'] as const),
} as const;

/**
 * Opciones explicitas de `prisma.$transaction()` para las transacciones
 * interactivas criticas del negocio (ventas, compras, inventario, caja).
 *
 * Sin esto, Prisma aplica sus defaults (`timeout: 5000ms`, `maxWait: 2000ms`),
 * pensados para transacciones triviales de una sola escritura. Las
 * transacciones de ventas/compras recorren sus lineas de forma secuencial
 * (`recordMovement` por cada item), por lo que 5s puede no alcanzar con
 * carritos grandes; y con un pool de conexiones reducido, esperar mas de 2s
 * por una conexion libre es razonable antes de fallar. Estos valores no
 * cambian ninguna logica de negocio, solo cuanto tiempo se le da a la misma
 * logica antes de que Prisma la aborte por timeout.
 */
export const transactionConfig = {
  /** Transacciones de una sola escritura (ajuste de inventario, cierre de caja). */
  standard: { maxWait: 5_000, timeout: 10_000 },
  /** Transacciones que iteran sobre lineas de un carrito (ventas, compras, devoluciones). */
  bulk: { maxWait: 5_000, timeout: 20_000 },
} as const;
