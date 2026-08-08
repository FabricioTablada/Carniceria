/**
 * modules/cabys/catalogSync.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos del flujo "Buscar actualizaciones" del catalogo CABYS.
 * Lee/escribe unicamente `CabysCatalogSync` (singleton) y `CabysCode`
 * (conteo), mas una lectura de solo consulta sobre `Product`/`Tax` para el
 * reporte de revision post-actualizacion (requisito 7 del bloque aprobado)
 * — nunca escribe en `Product`/`Tax`.
 */
import { prisma } from '@/database';

const SYNC_STATE_ID = 'singleton';

export async function getSyncState() {
  return prisma.cabysCatalogSync.findUnique({ where: { id: SYNC_STATE_ID } });
}

export async function upsertSyncState(data: {
  lastEtag: string | null;
  lastModified: string | null;
  lastSyncedAt: Date;
  recordCount: number;
}) {
  return prisma.cabysCatalogSync.upsert({
    where: { id: SYNC_STATE_ID },
    create: { id: SYNC_STATE_ID, ...data },
    update: data,
  });
}

export async function countActiveCodes(): Promise<number> {
  return prisma.cabysCode.count({ where: { active: true } });
}

/** Solo lectura — productos activos cuyo `cabysCode` esta entre los
 * codigos cuyo `taxIndicator` acaba de cambiar. Usado exclusivamente para
 * generar el reporte informativo de "productos a revisar" (requisito 7);
 * nunca modifica `Product`/`Tax`. */
export async function findActiveProductsByCabysCodes(codes: string[]) {
  if (codes.length === 0) return [];

  return prisma.product.findMany({
    where: { active: true, deletedAt: null, cabysCode: { in: codes } },
    select: {
      id: true,
      name: true,
      cabysCode: true,
      tax: { select: { name: true, rate: true } },
    },
  });
}
