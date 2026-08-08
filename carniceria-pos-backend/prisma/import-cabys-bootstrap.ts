/**
 * prisma/import-cabys-bootstrap.ts
 * -----------------------------------------------------------------------------
 * Version 1.1 — variante NO interactiva de `import-cabys.ts`, pensada
 * exclusivamente para el arranque automático de `carniceria-pos-desktop`
 * (ver `electron/migrations.ts::runCabysBootstrap`, mismo patron que
 * `seed-permissions.ts`). `import-cabys.ts` (el script manual, sin
 * cambios) sigue siendo la unica via para cargar/actualizar el catalogo a
 * mano — este archivo NO lo reemplaza, reutiliza sus mismas funciones
 * (`downloadOfficialCatalog`/`readCabysFile`/`computeDiff`/`applyDiff`)
 * sin duplicar logica.
 *
 * Reglas de este bootstrap, todas explicitas por diseño:
 *  - Solo actua si la tabla esta REALMENTE vacia (`count() === 0`). Si ya
 *    tiene aunque sea un solo codigo, no hace absolutamente nada — nunca
 *    reimporta, nunca pisa datos existentes. Esto es lo que reemplaza a
 *    la confirmacion interactiva del script manual: al ser exclusivamente
 *    una carga inicial sobre una tabla vacia, no hay ninguna decision
 *    ambigua que confirmar.
 *  - Si la descarga/importacion falla (sin internet, BCCR caido, etc.),
 *    el error se registra con detalle via el logger real del backend —
 *    pero este proceso SIEMPRE termina con exito (nunca hace que el
 *    arranque de la aplicacion falle). El catalogo simplemente queda
 *    vacio hasta el proximo arranque, que vuelve a intentar automatico
 *    (mismo chequeo de arriba) — sin ninguna accion manual del usuario.
 */
import { unlink } from 'node:fs/promises';
import { prisma } from '../src/database/prisma.client';
import { logger } from '../src/config';
import { applyDiff, computeDiff, downloadOfficialCatalog, readCabysFile } from './import-cabys';

async function main(): Promise<void> {
  const existingCount = await prisma.cabysCode.count();

  if (existingCount > 0) {
    logger.info(
      `Catálogo CABYS ya cargado (${existingCount} códigos) — se omite la importación automática de arranque.`,
    );
    return;
  }

  logger.info('Catálogo CABYS vacío — iniciando importación automática desde el arranque.');

  let filePath: string | null = null;
  try {
    filePath = await downloadOfficialCatalog();
    const { rows, skippedRowsCount } = await readCabysFile(filePath);
    const diff = await computeDiff(rows);
    await applyDiff(diff);
    logger.info(
      `Importación automática de CABYS completada: ${diff.toCreate.length} código(s) nuevo(s) ` +
        `(${skippedRowsCount} fila(s) del archivo oficial ignoradas por formato inválido).`,
    );
  } finally {
    if (filePath) {
      await unlink(filePath).catch(() => undefined);
    }
  }
}

main()
  .catch((error) => {
    // Nunca debe bloquear el arranque de la aplicacion — se registra el
    // error con detalle y el proceso igual termina exitosamente (sin
    // `process.exitCode`): el catalogo queda vacio hasta el proximo
    // arranque, que reintenta automaticamente sin ninguna accion manual.
    logger.error(
      { err: error },
      'La importación automática del catálogo CABYS falló — la aplicación continuará sin el catálogo cargado; se reintentará en el próximo arranque.',
    );
  })
  .finally(() => {
    void prisma.$disconnect();
  });
