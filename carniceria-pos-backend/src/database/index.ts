/**
 * database/index.ts
 * -----------------------------------------------------------------------------
 * Punto de acceso a la infraestructura de persistencia.
 */
import { prisma } from './prisma.client';
import type { DbClient } from './prisma.client';
import { logger } from '@/config';

export { prisma };
export type { DbClient };

/** Verifica la conexion a PostgreSQL durante el arranque. */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Conexion a PostgreSQL establecida.');
}

/** Cierra la conexion de forma ordenada (graceful shutdown). */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Conexion a PostgreSQL cerrada.');
}
