/**
 * modules/cabys/catalogImport.ts
 * -----------------------------------------------------------------------------
 * Bloque "Actualizacion inteligente del catalogo CABYS": logica de
 * lectura/comparacion/aplicacion del catalogo oficial, EXTRAIDA de
 * `prisma/import-cabys.ts` (script de terminal, sin cambios de
 * comportamiento) para que tambien la reutilice `catalogSync.service.ts`
 * (la nueva ruta HTTP de "Buscar actualizaciones" desde la interfaz del
 * ERP). Unica fuente de verdad de esta logica — no duplicar.
 *
 * Import con RUTAS RELATIVAS (nunca el alias `@/*`) a proposito: este
 * archivo lo ejecuta tambien `prisma/import-cabys.ts` via `tsx`, fuera del
 * build normal de `tsc`/`tsc-alias` — mismo criterio que ya usan
 * `prisma/seed-permissions.ts`/`prisma/reset-password.ts` al importar de
 * `src/`.
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import axios from 'axios';
import { parse as parseCsv } from 'csv-parse';
import ExcelJS from 'exceljs';
import { prisma } from '../../database/prisma.client';
import { logger } from '../../config';

/** Unica fuente oficial soportada — ver justificacion completa en
 * `prisma/import-cabys.ts` (comentario de cabecera original). */
export const OFFICIAL_CATALOG_URL =
  'https://www.bccr.fi.cr/indicadores-economicos/cabys/Catalogo-de-bienes-servicios.xlsx';
/** El sitio del BCCR (SharePoint) responde 500 ("URL Rewrite Module
 * Error") a una peticion sin estos dos headers minimos — no es una
 * autenticacion real, es una regla anti-bot basica del servidor. */
export const OFFICIAL_CATALOG_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Referer: 'https://www.bccr.fi.cr/indicadores-economicos/cat%C3%A1logo-de-bienes-y-servicios',
};

/** Fila ya normalizada, lista para comparar contra la base de datos. */
export interface CabysRow {
  code: string;
  description: string;
  taxIndicator: string | null;
}

const REQUIRED_COLUMNS: Record<'code' | 'description', string[]> = {
  code: ['CODIGO', 'CODIGO CABYS', 'CODIGO DE CABYS', 'CABYS', 'COD CABYS', 'CATEGORIA 9'],
  description: [
    'DESCRIPCION',
    'DESCRIPCION CABYS',
    'DESCRIPCION DEL CODIGO',
    'DESCRIPCION DE CABYS',
    'DETALLE',
    'DESCRIPCION (CATEGORIA 9)',
  ],
};

const OPTIONAL_TAX_COLUMN_ALIASES = ['IMPUESTO', 'TARIFA', 'TARIFA IVA', 'TARIFA DE IMPUESTO'];

function resolveOptionalTaxColumnIndex(headerRow: string[]): number {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) => OPTIONAL_TAX_COLUMN_ALIASES.includes(header));
}

const CODE_PATTERN = /^\d{13}$/;
const XLSX_HEADER_SEARCH_ROWS = 10;

function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function resolveColumnIndexes(headerRow: string[]): { code: number; description: number } {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const missing: string[] = [];

  const indexes: Partial<Record<'code' | 'description', number>> = {};

  for (const field of Object.keys(REQUIRED_COLUMNS) as Array<'code' | 'description'>) {
    const aliases = REQUIRED_COLUMNS[field];
    const foundIndex = normalizedHeaders.findIndex((header) => aliases.includes(header));

    if (foundIndex === -1) {
      missing.push(field === 'code' ? 'código CABYS' : 'descripción');
    } else {
      indexes[field] = foundIndex;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `El archivo no tiene un formato reconocible: no se pudo identificar la(s) columna(s) obligatoria(s) ${missing
        .map((name) => `"${name}"`)
        .join(', ')} por su nombre de encabezado. Encabezados encontrados en el archivo: ` +
        `${headerRow.map((header) => `"${header}"`).join(', ')}. No se modificó ningún dato.`,
    );
  }

  return indexes as { code: number; description: number };
}

function accumulateRow(
  byCode: Map<string, CabysRow>,
  rawCode: string,
  rawDescription: string,
  rawTaxIndicator: string | null,
): boolean {
  const code = rawCode.trim();
  const description = rawDescription.trim();
  const taxIndicator = rawTaxIndicator === null ? null : rawTaxIndicator.trim() || null;

  if (!CODE_PATTERN.test(code) || description.length === 0) {
    return false;
  }

  byCode.set(code, { code, description, taxIndicator });
  return true;
}

async function readCabysCsv(
  filePath: string,
): Promise<{ rows: CabysRow[]; skippedRowsCount: number }> {
  const parser = createReadStream(filePath).pipe(
    parseCsv({ bom: true, skip_empty_lines: true, relax_column_count: true }),
  );

  let headerRow: string[] | null = null;
  let codeIndex = -1;
  let descriptionIndex = -1;
  let taxIndicatorIndex = -1;
  const byCode = new Map<string, CabysRow>();
  let skippedRowsCount = 0;

  for await (const record of parser as AsyncIterable<string[]>) {
    if (!headerRow) {
      headerRow = record;
      const resolved = resolveColumnIndexes(headerRow);
      codeIndex = resolved.code;
      descriptionIndex = resolved.description;
      taxIndicatorIndex = resolveOptionalTaxColumnIndex(headerRow);
      continue;
    }

    const accumulated = accumulateRow(
      byCode,
      record[codeIndex] ?? '',
      record[descriptionIndex] ?? '',
      taxIndicatorIndex === -1 ? null : record[taxIndicatorIndex] ?? null,
    );
    if (!accumulated) {
      skippedRowsCount += 1;
    }
  }

  if (!headerRow) {
    throw new Error('El archivo está vacío: no tiene ni siquiera una fila de encabezados.');
  }

  return { rows: Array.from(byCode.values()), skippedRowsCount };
}

/** `Row.values` de exceljs esta tipado como `CellValue[] | { [key: string]: CellValue }`
 * segun la version del tipo — en la practica siempre es el array disperso
 * (indice 0 sin usar), pero normalizamos explicitamente para no depender
 * de esa forma union en el resto del codigo. */
function rowValuesToArray(row: ExcelJS.Row): unknown[] {
  const raw = row.values;
  return Array.isArray(raw) ? raw : Object.values(raw);
}

function cellValueToText(value: unknown, padToThirteen: boolean): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return padToThirteen ? String(value).padStart(13, '0') : String(value);
  }
  if (typeof value === 'object' && 'result' in (value as Record<string, unknown>)) {
    return cellValueToText((value as { result: unknown }).result, padToThirteen);
  }
  return String(value).trim();
}

async function readCabysXlsx(
  filePath: string,
): Promise<{ rows: CabysRow[]; skippedRowsCount: number }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('El archivo .xlsx no tiene ninguna hoja de cálculo.');
  }

  let codeIndex = -1;
  let descriptionIndex = -1;
  let taxIndicatorIndex = -1;
  let headerRowNumber = -1;
  let lastAttemptError: Error | null = null;

  const searchLimit = Math.min(XLSX_HEADER_SEARCH_ROWS, worksheet.rowCount);
  for (let rowNumber = 1; rowNumber <= searchLimit; rowNumber += 1) {
    const candidateRow = rowValuesToArray(worksheet.getRow(rowNumber))
      .slice(1)
      .map((cell) => cellValueToText(cell, false));

    try {
      const resolved = resolveColumnIndexes(candidateRow);
      codeIndex = resolved.code;
      descriptionIndex = resolved.description;
      taxIndicatorIndex = resolveOptionalTaxColumnIndex(candidateRow);
      headerRowNumber = rowNumber;
      break;
    } catch (error) {
      lastAttemptError = error as Error;
    }
  }

  if (headerRowNumber === -1) {
    throw new Error(
      `No se pudo identificar una fila de encabezados reconocible en las primeras ${searchLimit} filas de la hoja "${worksheet.name}". ` +
        `${lastAttemptError?.message ?? ''}`.trim(),
    );
  }

  const byCode = new Map<string, CabysRow>();
  let skippedRowsCount = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rawCode = cellValueToText(row.getCell(codeIndex + 1).value, true);
    const rawDescription = cellValueToText(row.getCell(descriptionIndex + 1).value, false);
    const rawTaxIndicator =
      taxIndicatorIndex === -1 ? null : cellValueToText(row.getCell(taxIndicatorIndex + 1).value, false);

    const accumulated = accumulateRow(byCode, rawCode, rawDescription, rawTaxIndicator);
    if (!accumulated) {
      skippedRowsCount += 1;
    }
  }

  return { rows: Array.from(byCode.values()), skippedRowsCount };
}

/** Despacha al lector correcto segun la extension del archivo — CSV
 * (formato simple, uso manual/offline) o `.xlsx`/`.xls` (formato real del
 * catalogo oficial). */
export async function readCabysFile(
  filePath: string,
): Promise<{ rows: CabysRow[]; skippedRowsCount: number }> {
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();

  if (extension === '.xlsx' || extension === '.xls') {
    return readCabysXlsx(filePath);
  }

  return readCabysCsv(filePath);
}

/**
 * Descarga el catalogo oficial real desde el BCCR a un archivo temporal
 * fuera del repositorio (`os.tmpdir()`) — nunca se persiste ni se versiona.
 * El llamador es responsable de borrarlo.
 */
export async function downloadOfficialCatalog(): Promise<string> {
  logger.info(`Descargando catálogo oficial desde: ${OFFICIAL_CATALOG_URL}`);

  const response = await axios.get<NodeJS.ReadableStream>(OFFICIAL_CATALOG_URL, {
    headers: OFFICIAL_CATALOG_REQUEST_HEADERS,
    responseType: 'stream',
    validateStatus: (status) => status === 200,
  });

  const tempPath = join(tmpdir(), `cabys-oficial-${Date.now()}.xlsx`);
  const writeStream = createWriteStream(tempPath);

  try {
    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writeStream);
      response.data.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });
  } catch (error) {
    // Bloque de limpieza de temporales: si la conexion se corta a mitad de
    // la descarga, el archivo ya existe en disco (parcial/corrupto) — se
    // borra ACA, en el mismo lugar donde se crea, para que la garantia de
    // "nunca dejar archivos huerfanos" no dependa de que cada llamador
    // recuerde limpiar tras un fallo que ocurre antes de que la funcion
    // devuelva ningun `filePath` utilizable.
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  logger.info(`Descarga completa: ${tempPath}`);
  return tempPath;
}

/** Metadata de version del archivo oficial, obtenida SIN descargarlo
 * completo — una peticion `Range` de 2 bytes contra la misma URL oficial.
 * El servidor (SharePoint) responde `206 Partial Content` con las mismas
 * cabeceras `ETag`/`Last-Modified`/`Content-Range` que traeria una
 * descarga completa (verificado en vivo contra la URL real: ETag con
 * formato `"{GUID},N}"`, donde `N` es la version interna del documento en
 * SharePoint — cambia cuando el BCCR sube un archivo nuevo). No es un
 * contrato documentado por el BCCR, es infraestructura de SharePoint: se
 * trata como heuristica, nunca como garantia — ver `checkForUpdates`. */
export interface RemoteCatalogVersion {
  etag: string | null;
  lastModified: string | null;
  contentLength: number | null;
}

export async function checkRemoteCatalogVersion(): Promise<RemoteCatalogVersion> {
  const response = await axios.get<Readable>(OFFICIAL_CATALOG_URL, {
    headers: { ...OFFICIAL_CATALOG_REQUEST_HEADERS, Range: 'bytes=0-1' },
    responseType: 'stream',
    validateStatus: (status) => status === 200 || status === 206,
  });

  // No necesitamos el cuerpo, solo las cabeceras — pero el socket debe
  // consumirse/destruirse para no dejarlo colgado.
  response.data.destroy();

  const etag = (response.headers.etag as string | undefined) ?? null;
  const lastModified = (response.headers['last-modified'] as string | undefined) ?? null;
  const contentRange = response.headers['content-range'] as string | undefined;
  const totalMatch = contentRange ? /\/(\d+)$/.exec(contentRange) : null;
  const contentLength = totalMatch ? Number(totalMatch[1]) : null;

  return { etag, lastModified, contentLength };
}

export interface DiffResult {
  toCreate: CabysRow[];
  toUpdate: CabysRow[];
  toRetire: string[];
  unchangedCount: number;
  /** Subconjunto de `toUpdate`: codigos cuya `description` cambio
   * (independientemente de si tambien cambio `taxIndicator`) — solo para
   * el resumen mostrado al usuario, `applyDiff` sigue iterando `toUpdate`
   * completo sin distinguir el campo. */
  descriptionChangedCodes: string[];
  /** Subconjunto de `toUpdate`: codigos cuyo `taxIndicator` cambio — usado
   * tambien por el reporte de "productos a revisar" post-actualizacion
   * (`catalogSync.service.ts`). */
  taxIndicatorChangedCodes: string[];
}

/** Compara el archivo (ya parseado y deduplicado) contra el estado actual
 * completo de la tabla — sin escribir nada todavia. */
export async function computeDiff(fileRows: CabysRow[]): Promise<DiffResult> {
  const existing = await prisma.cabysCode.findMany({
    select: { code: true, description: true, taxIndicator: true, active: true },
  });
  const existingByCode = new Map(existing.map((row) => [row.code, row]));
  const fileCodes = new Set(fileRows.map((row) => row.code));

  const toCreate: CabysRow[] = [];
  const toUpdate: CabysRow[] = [];
  const descriptionChangedCodes: string[] = [];
  const taxIndicatorChangedCodes: string[] = [];
  let unchangedCount = 0;

  for (const row of fileRows) {
    const current = existingByCode.get(row.code);

    if (!current) {
      toCreate.push(row);
      continue;
    }

    const descriptionChanged = current.description !== row.description;
    const taxIndicatorChanged = current.taxIndicator !== row.taxIndicator;

    if (descriptionChanged || taxIndicatorChanged || !current.active) {
      toUpdate.push(row);
      if (descriptionChanged) descriptionChangedCodes.push(row.code);
      if (taxIndicatorChanged) taxIndicatorChangedCodes.push(row.code);
    } else {
      unchangedCount += 1;
    }
  }

  const toRetire = existing
    .filter((row) => row.active && !fileCodes.has(row.code))
    .map((row) => row.code);

  return { toCreate, toUpdate, toRetire, unchangedCount, descriptionChangedCodes, taxIndicatorChangedCodes };
}

/** El catalogo oficial real tiene ~20 500 codigos (verificado) — una unica
 * transaccion interactiva con un `create`/`update` por fila excede el
 * timeout por defecto de Prisma mucho antes de terminar. Se procesa en
 * lotes pequenos en su lugar: cada lote es atomico en si mismo, el proceso
 * completo es idempotente por codigo (upsert). */
const APPLY_BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function batchErrorMessage(
  stage: 'creando' | 'actualizando' | 'retirando',
  batchNumber: number,
  totalBatches: number,
  error: unknown,
): string {
  return (
    `Error ${stage} el lote ${batchNumber}/${totalBatches} de códigos CABYS. ` +
    `Los lotes anteriores ya quedaron aplicados en la base de datos — volvé a ejecutar la misma importación ` +
    `para retomarla donde se interrumpió (el proceso es idempotente por código, no se duplica ni se corrompe nada). ` +
    `Causa original: ${(error as Error).message}`
  );
}

export async function applyDiff(diff: DiffResult): Promise<void> {
  const createBatches = chunk(diff.toCreate, APPLY_BATCH_SIZE);
  for (let i = 0; i < createBatches.length; i += 1) {
    try {
      await prisma.cabysCode.createMany({
        data: createBatches[i].map((row) => ({
          code: row.code,
          description: row.description,
          taxIndicator: row.taxIndicator,
          active: true,
        })),
      });
    } catch (error) {
      throw new Error(batchErrorMessage('creando', i + 1, createBatches.length, error));
    }
  }

  const updateBatches = chunk(diff.toUpdate, APPLY_BATCH_SIZE);
  for (let i = 0; i < updateBatches.length; i += 1) {
    try {
      await prisma.$transaction(
        updateBatches[i].map((row) =>
          prisma.cabysCode.update({
            where: { code: row.code },
            data: { description: row.description, taxIndicator: row.taxIndicator, active: true },
          }),
        ),
      );
    } catch (error) {
      throw new Error(batchErrorMessage('actualizando', i + 1, updateBatches.length, error));
    }
  }

  const retireBatches = chunk(diff.toRetire, APPLY_BATCH_SIZE);
  for (let i = 0; i < retireBatches.length; i += 1) {
    try {
      await prisma.cabysCode.updateMany({
        where: { code: { in: retireBatches[i] } },
        data: { active: false },
      });
    } catch (error) {
      throw new Error(batchErrorMessage('retirando', i + 1, retireBatches.length, error));
    }
  }
}
