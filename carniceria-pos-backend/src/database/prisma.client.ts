/**
 * database/prisma.client.ts
 * -----------------------------------------------------------------------------
 * Instancia UNICA (singleton) de Prisma Client con las extensiones de la
 * aplicacion aplicadas (soft delete, timestamps, sync_status).
 *
 * REGLA: ningun service o controller importa @prisma/client directamente.
 * Todo acceso a datos pasa por los repositorios, y estos usan `prisma` desde
 * aqui. Asi el comportamiento transversal (borrado logico, sync) es uniforme.
 *
 * En desarrollo se reutiliza la instancia entre recargas (hot-reload de tsx)
 * para no agotar el pool de conexiones de PostgreSQL.
 */
import { PrismaClient } from '@prisma/client';
import { databaseConfig, isProduction } from '@/config';
import { softDeleteExtension, syncStatusExtension, timestampsExtension } from './extensions';

function createPrismaClient() {
  return new PrismaClient({
    log: [...databaseConfig.prismaLogLevels],
  })
    .$extends(timestampsExtension)
    .$extends(softDeleteExtension)
    .$extends(syncStatusExtension);
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient;
};

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

/**
 * Tipo del cliente transaccional que Prisma entrega dentro del callback de
 * `prisma.$transaction(async (tx) => {...})`.
 *
 * `$transaction` en un cliente extendido con `$extends()` se tipa
 * internamente de forma auto-referencial (algo equivalente a
 * `(fn: (tx: Omit<this, ITXClientDenyList>) => Promise<T>) => Promise<T>`).
 * Extraer ese tipo indirectamente con `Parameters<>` no resuelve
 * correctamente esa auto-referencia fuera de su contexto de invocacion: en
 * su lugar devuelve el tipo extendido COMPLETO (con `$extends`,
 * `$transaction`, `$connect`, `$disconnect` incluidos), que es exactamente
 * lo que `tx` NO tiene en tiempo de ejecucion.
 *
 * Por eso `DbClient` se construye de forma directa, no se extrae: se aplica
 * `Omit<>` sobre `ExtendedPrismaClient` (el mismo tipo base del que Prisma
 * deriva `tx`), quitando exactamente los 4 metodos de ciclo de
 * vida/transaccion que un cliente transaccional no puede tener (no tendria
 * sentido anidar transacciones, reconectar o volver a extender dentro de
 * una transaccion ya activa). El resultado es estructuralmente identico al
 * tipo real de `tx`, no una aproximacion.
 */
export type DbClient = Omit<
  ExtendedPrismaClient,
  '$extends' | '$transaction' | '$disconnect' | '$connect'
>;
