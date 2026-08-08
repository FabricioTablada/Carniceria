/**
 * prisma/import-cabys.ts
 * -----------------------------------------------------------------------------
 * Version 1.2 — Asistente inteligente de codigos CABYS, Bloque de importacion.
 *
 * Script de terminal REUTILIZABLE (no expuesto por HTTP, mismo patron que
 * `seed-permissions.ts`/`reset-password.ts`) que carga el catalogo oficial
 * CABYS (Catalogo de Bienes y Servicios) en la tabla propia `cabys_codes`
 * (`prisma/schema.prisma`).
 *
 * Bloque "Actualizacion inteligente del catalogo CABYS": la logica de
 * lectura/parseo/diff/aplicacion se EXTRAJO a `src/modules/cabys/catalogImport.ts`
 * (sin cambios de comportamiento) para que la reutilice tambien el nuevo
 * flujo HTTP "Buscar actualizaciones" (`catalogSync.service.ts`), en vez de
 * duplicarla. Este archivo conserva unicamente lo especifico de la CLI:
 * parseo de argumentos, resumen impreso en terminal y confirmacion
 * interactiva.
 *
 * Decisiones de arquitectura ya aprobadas (no reabrir sin autorizacion):
 *  - El archivo oficial NUNCA se versiona en el repositorio — es
 *    unicamente el insumo transitorio de esta importacion, ya sea
 *    descargado automaticamente (`--download`) o indicado a mano
 *    (`--file=<ruta>`); en ambos casos se descarta al terminar.
 *  - Fuente oficial real: el Banco Central de Costa Rica (BCCR) publica y
 *    mantiene el catalogo CABYS en
 *    `https://www.bccr.fi.cr/indicadores-economicos/cabys/Catalogo-de-bienes-servicios.xlsx`
 *    — descarga directa por HTTPS `GET`, sin login ni captcha (el sitio,
 *    alojado en SharePoint, solo exige un `User-Agent` y un `Referer`).
 *  - Formato real del archivo oficial: jerarquico, encabezados en la fila 2,
 *    codigo CABYS de 13 digitos siempre en `Categoría 9`. Se parsea con
 *    `exceljs`. El formato CSV simple (`codigo`/`descripcion`) se mantiene
 *    soportado para uso manual/offline.
 *  - Columna opcional "Impuesto" (ver `CabysCode.taxIndicator`): se captura
 *    tal cual, sin normalizar — la interpretacion vive en
 *    `modules/products/cabysTaxCoherence.ts`.
 *  - Las columnas se identifican por NOMBRE de encabezado, nunca por
 *    posicion.
 *  - Upsert por codigo. Los codigos retirados del archivo oficial NUNCA se
 *    borran fisicamente: se marcan `active = false`.
 *  - Antes de escribir cualquier cambio, se muestra un resumen completo.
 *    Solo se escribe si el usuario confirma explicitamente en la terminal.
 *  - La escritura se hace en LOTES pequenos, idempotente por codigo.
 *
 * Uso:
 *   npm run import-cabys -- --download
 *   npm run import-cabys -- --file="C:\ruta\al\catalogo_cabys.xlsx"
 *   npm run import-cabys -- --file="C:\ruta\al\catalogo_cabys.csv"
 */
import { stat, unlink } from 'node:fs/promises';
import * as readline from 'node:readline/promises';
import { prisma } from '../src/database/prisma.client';
import { logger } from '../src/config';
import {
  applyDiff,
  computeDiff,
  downloadOfficialCatalog,
  readCabysFile,
  resolveColumnIndexes,
  type DiffResult,
} from '../src/modules/cabys/catalogImport';

type ParsedArgs = { mode: 'download' } | { mode: 'file'; filePath: string };

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();
  let download = false;

  for (const arg of argv) {
    if (arg === '--download') {
      download = true;
      continue;
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      values.set(match[1], match[2]);
    }
  }

  const filePath = values.get('file');

  if (download && filePath) {
    throw new Error('Indica solo uno: --download o --file=<ruta>, no ambos.');
  }

  if (download) {
    return { mode: 'download' };
  }

  if (!filePath) {
    throw new Error(
      'Debes indicar --download (descarga automática del catálogo oficial) o --file=<ruta al archivo .xlsx o .csv>.',
    );
  }

  return { mode: 'file', filePath };
}

function printSummary(diff: DiffResult, totalProcessed: number, skippedRowsCount: number): void {
  const lines = [
    'Resumen del análisis (todavía no se escribió nada en la base de datos):',
    `  Registros nuevos:                 ${diff.toCreate.length}`,
    `  Registros actualizados:           ${diff.toUpdate.length}`,
    `    (de los cuales, descripción modificada: ${diff.descriptionChangedCodes.length})`,
    `    (de los cuales, impuesto modificado:    ${diff.taxIndicatorChangedCodes.length})`,
    `  Registros sin cambios:            ${diff.unchangedCount}`,
    `  Registros que quedarían retirados: ${diff.toRetire.length}`,
    `  Total de registros procesados:    ${totalProcessed}`,
  ];

  if (skippedRowsCount > 0) {
    lines.push(
      `  (${skippedRowsCount} fila(s) del archivo se ignoraron por no tener un código de 13 dígitos o descripción válidos.)`,
    );
  }

  logger.info(lines.join('\n'));
}

async function promptConfirmation(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    logger.info(
      'No se detectó una terminal interactiva para solicitar confirmación — se aborta sin escribir ningún dato.',
    );
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('¿Confirmás ejecutar esta importación? (si/no): ');
    return answer.trim().toLowerCase() === 'si' || answer.trim().toLowerCase() === 's';
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const filePath = args.mode === 'download' ? await downloadOfficialCatalog() : args.filePath;

  try {
    const fileInfo = await stat(filePath).catch(() => null);
    if (!fileInfo || !fileInfo.isFile()) {
      throw new Error(`No se encontró el archivo indicado: "${filePath}".`);
    }

    logger.info(`Leyendo e identificando columnas por nombre en: ${filePath}`);
    const { rows, skippedRowsCount } = await readCabysFile(filePath);

    logger.info(`Comparando ${rows.length} código(s) del archivo contra la tabla actual...`);
    const diff = await computeDiff(rows);
    const totalProcessed = diff.toCreate.length + diff.toUpdate.length + diff.unchangedCount;

    printSummary(diff, totalProcessed, skippedRowsCount);

    if (diff.toCreate.length === 0 && diff.toUpdate.length === 0 && diff.toRetire.length === 0) {
      logger.info('No hay cambios para aplicar. No se modificó ningún dato.');
      return;
    }

    const confirmed = await promptConfirmation();
    if (!confirmed) {
      logger.info('Importación cancelada. No se modificó ningún dato.');
      return;
    }

    logger.info('Aplicando cambios en lotes...');
    await applyDiff(diff);
    logger.info('Importación completada correctamente.');
  } finally {
    // El archivo temporal de `--download` nunca debe persistir, sin
    // importar el resultado (exito, cancelacion o error) — un `--file`
    // provisto por el usuario nunca se borra, es de su responsabilidad.
    if (args.mode === 'download') {
      await unlink(filePath).catch(() => undefined);
    }
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      logger.error({ err: error }, 'Error durante la importación del catálogo CABYS.');
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}

export { readCabysFile, computeDiff, applyDiff, resolveColumnIndexes, downloadOfficialCatalog };
