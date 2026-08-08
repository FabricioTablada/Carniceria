/**
 * modules/cabys/catalogSync.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del bloque "Actualizacion inteligente del catalogo
 * CABYS" — flujo aprobado:
 *
 *   Buscar actualizaciones -> checkForUpdates() (liviano, NUNCA descarga
 *   el archivo completo) -> si hay version nueva -> previewUpdate()
 *   (descarga a un archivo temporal, VALIDA, compara, nunca escribe) ->
 *   el usuario confirma -> applyUpdate() (revalida el diff contra el
 *   estado actual, aplica, registra auditoria, genera el reporte de
 *   productos a revisar).
 *
 * Reglas estrictas del bloque aprobado (no ampliar sin autorizacion):
 *  - Nunca modifica `Product`/`Tax`/Compras/Ventas/Facturas/Historial.
 *  - Nunca aplica nada automaticamente: `applyUpdate` solo corre sobre un
 *    diff ya mostrado al usuario (`previewUpdate`), identificado por un
 *    token de vista previa de corta duracion.
 *  - El estado de la ultima sincronizacion (`lastEtag`/`lastModified`/
 *    `recordCount`) se guarda en `CabysCatalogSync` (tabla dedicada,
 *    unica config global reutilizable analizada que encajaba: `Configuration`
 *    es per-sucursal). El EVENTO de cada actualizacion aplicada se
 *    registra aparte en `AuditLog` (quien/cuando/que cambio) — la
 *    auditoria nunca almacena el estado actual del catalogo.
 *
 * Auditoria final del modulo (aprobada, tres protecciones agregadas en este
 * bloque, sin cambiar el flujo ni la interfaz):
 *  - BLOQUE 1: los errores de red/formato ya NO caen en el "Ocurrio un
 *    error interno" generico — se clasifican y se relanzan como
 *    `ExternalServiceError`/`ValidationError` (ver `classifyRemoteCatalogError`/
 *    `toFormatError`), que si preservan su mensaje al cliente
 *    (`errorHandler.middleware.ts`). Nunca se expone un stacktrace: el
 *    detalle tecnico original, cuando existe, viaja unicamente en
 *    `details.technicalMessage` (texto ya de por si descriptivo, nunca el
 *    stack).
 *  - BLOQUE 2: la limpieza del archivo temporal de descarga ahora se
 *    garantiza en el propio `catalogImport.ts::downloadOfficialCatalog`
 *    (se borra ahi mismo si la descarga falla a mitad de camino), ademas
 *    del `finally` ya existente en `previewUpdate` que cubre errores de
 *    lectura/validacion posteriores.
 *  - BLOQUE 3: `applyUpdate` ya NO aplica ciegamente el diff cacheado del
 *    preview — recalcula el diff contra el estado ACTUAL de `CabysCode`
 *    justo antes de aplicar y cancela con un `ValidationError` claro si el
 *    catalogo cambio desde que se genero la vista previa.
 */
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import axios from 'axios';
import { AuditAction } from '@/shared/constants';
import { auditService } from '@/shared/services/audit.service';
import { ExternalServiceError, ValidationError } from '@/shared/errors';
import { interpretOfficialTaxRate } from '@/modules/products/cabysTaxCoherence';
import {
  applyDiff,
  checkRemoteCatalogVersion,
  computeDiff,
  downloadOfficialCatalog,
  readCabysFile,
  type CabysRow,
  type DiffResult,
} from './catalogImport';
import * as repository from './catalogSync.repository';
import type {
  ApplyCatalogUpdateResult,
  CatalogDiffSummary,
  CheckForUpdatesResult,
  PreviewCatalogUpdateResult,
  ProductToReview,
  RemoteCatalogVersion,
} from './catalogSync.types';

/** Vista previa activa: uso administrativo esporadico, un unico proceso
 * backend — no justifica una tabla nueva solo para un estado transitorio
 * de minutos (analizado y aprobado). Se pierde si el backend reinicia
 * entre la vista previa y la confirmacion — comportamiento aceptable
 * (el usuario simplemente vuelve a "Buscar actualizaciones"). Guarda
 * tambien `fileRows` (BLOQUE 3): son las filas ya parseadas del archivo
 * descargado, necesarias para poder recalcular el diff contra el estado
 * actual de `CabysCode` justo antes de aplicar, sin volver a descargar
 * nada. */
interface PendingPreview {
  fileRows: CabysRow[];
  diff: DiffResult;
  remote: RemoteCatalogVersion;
  expiresAt: number;
}

const PREVIEW_TTL_MS = 15 * 60 * 1000;
const pendingPreviews = new Map<string, PendingPreview>();

/** El archivo oficial real tiene ~20 500 codigos activos — un archivo
 * descargado con menos del 90% de eso es tratado como potencialmente
 * corrupto/truncado y se rechaza antes de mostrar ningun resumen (validado
 * en el analisis aprobado). */
const MIN_RECORD_RATIO = 0.9;

function cleanupExpiredPreviews(): void {
  const now = Date.now();
  for (const [token, preview] of pendingPreviews) {
    if (preview.expiresAt <= now) {
      pendingPreviews.delete(token);
    }
  }
}

function toSummary(diff: DiffResult): CatalogDiffSummary {
  return {
    newCodesCount: diff.toCreate.length,
    descriptionChangedCount: diff.descriptionChangedCodes.length,
    taxIndicatorChangedCount: diff.taxIndicatorChangedCodes.length,
    retiredCodesCount: diff.toRetire.length,
    unchangedCount: diff.unchangedCount,
  };
}

/**
 * BLOQUE 1 — clasifica un error de red/HTTP contra el BCCR (surgido de
 * `checkRemoteCatalogVersion`/`downloadOfficialCatalog`, ambos basados en
 * Axios) en un `ExternalServiceError` con un mensaje claro y especifico.
 * Nunca deja pasar el error original (que `errorHandler.middleware.ts`
 * trataria como "no controlado", devolviendo el generico "Ocurrio un
 * error interno" y, en produccion, ocultando hasta el mensaje). Distingue
 * los tres casos pedidos en la auditoria: sin conexion, timeout, y error
 * HTTP explicito del servidor del BCCR.
 */
function classifyRemoteCatalogError(error: unknown, actionMessage: string): ExternalServiceError {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ExternalServiceError(
        'El servidor del BCCR tardó demasiado en responder (tiempo de espera agotado). Intente nuevamente en unos minutos.',
      );
    }

    if (error.response) {
      return new ExternalServiceError(
        `El servidor del BCCR respondió con un error (HTTP ${error.response.status}). ${actionMessage}`,
      );
    }

    // Sin `response`: la peticion nunca llego a tener respuesta (DNS,
    // conexion rechazada, sin red disponible) — este es el caso "sin
    // conexion" de la auditoria.
    return new ExternalServiceError(
      'No fue posible conectarse al servidor del BCCR. Verifique la conexión a Internet e intente nuevamente.',
    );
  }

  // Error no-Axios durante la descarga (p. ej. el stream de escritura a
  // disco falla) — mismo mensaje generico de "no se pudo descargar", sin
  // exponer el error tecnico original al cliente.
  return new ExternalServiceError(actionMessage);
}

/**
 * BLOQUE 1 — clasifica un error de lectura/parseo del archivo (`.xlsx`
 * corrupto, columnas obligatorias ausentes por un cambio de formato del
 * BCCR, etc.) en un `ValidationError` con el mensaje claro pedido en la
 * auditoria. El mensaje tecnico original (ya descriptivo por diseño de
 * `resolveColumnIndexes`, nunca un stacktrace) viaja unicamente en
 * `details.technicalMessage`, para diagnostico, sin reemplazar el mensaje
 * principal que ve el usuario.
 */
function toFormatError(error: unknown): ValidationError {
  if (error instanceof ValidationError) {
    return error;
  }

  const technicalMessage = error instanceof Error ? error.message : String(error);
  return new ValidationError('El formato del catálogo oficial cambió y no pudo ser procesado.', {
    technicalMessage,
  });
}

/** Compara la version remota contra la ultima guardada — SIN descargar el
 * archivo completo (ver `catalogImport.ts::checkRemoteCatalogVersion`).
 * Sin estado previo, se considera que hay actualizacion disponible (nunca
 * se sincronizo todavia). */
export async function checkForUpdates(): Promise<CheckForUpdatesResult> {
  let remote: RemoteCatalogVersion;
  try {
    remote = await checkRemoteCatalogVersion();
  } catch (error) {
    throw classifyRemoteCatalogError(
      error,
      'No fue posible verificar la versión del catálogo oficial.',
    );
  }

  const state = await repository.getSyncState();

  if (!state) {
    return { hasUpdate: true, remote };
  }

  const hasUpdate =
    remote.etag !== null ? remote.etag !== state.lastEtag : remote.lastModified !== state.lastModified;

  return { hasUpdate, remote };
}

/** Descarga a un archivo temporal, VALIDA (formato, columnas, cantidad de
 * registros) y calcula el diff contra el catalogo actual — nunca escribe
 * nada. Devuelve un token de corta duracion que `applyUpdate` debe recibir
 * para revalidar y aplicar ese mismo diff (BLOQUE 3: nunca se confia
 * ciegamente en el diff cacheado, se recalcula contra el estado actual
 * justo antes de aplicar). */
export async function previewUpdate(): Promise<PreviewCatalogUpdateResult> {
  cleanupExpiredPreviews();

  let remote: RemoteCatalogVersion;
  try {
    remote = await checkRemoteCatalogVersion();
  } catch (error) {
    throw classifyRemoteCatalogError(
      error,
      'No fue posible verificar la versión del catálogo oficial.',
    );
  }

  let filePath: string;
  try {
    filePath = await downloadOfficialCatalog();
  } catch (error) {
    throw classifyRemoteCatalogError(error, 'No fue posible descargar el catálogo oficial.');
  }

  try {
    let fileRows: CabysRow[];
    try {
      const parsed = await readCabysFile(filePath);
      fileRows = parsed.rows;
    } catch (error) {
      throw toFormatError(error);
    }

    if (fileRows.length === 0) {
      throw new ValidationError(
        'El archivo descargado no contiene ningún código CABYS válido. No se modificó ningún dato.',
      );
    }

    const currentActiveCount = await repository.countActiveCodes();
    if (currentActiveCount > 0 && fileRows.length < currentActiveCount * MIN_RECORD_RATIO) {
      throw new ValidationError(
        `El archivo descargado trae ${fileRows.length} código(s), muy por debajo del catálogo actual ` +
          `(${currentActiveCount}). Podría estar corrupto o incompleto. No se modificó ningún dato.`,
      );
    }

    const diff = await computeDiff(fileRows);
    const token = randomUUID();
    const expiresAt = Date.now() + PREVIEW_TTL_MS;
    pendingPreviews.set(token, { fileRows, diff, remote, expiresAt });

    return {
      previewToken: token,
      summary: toSummary(diff),
      expiresAt: new Date(expiresAt).toISOString(),
      remote,
    };
  } finally {
    // BLOQUE 2: cubre los errores que ocurren DESPUES de tener el archivo
    // ya descargado (lectura/parseo/validacion) — la limpieza del fallo
    // DURANTE la descarga misma ahora vive en
    // `catalogImport.ts::downloadOfficialCatalog`.
    await unlink(filePath).catch(() => undefined);
  }
}

async function buildProductsToReviewReport(diff: DiffResult): Promise<ProductToReview[]> {
  if (diff.taxIndicatorChangedCodes.length === 0) {
    return [];
  }

  const newIndicatorByCode = new Map(diff.toUpdate.map((row) => [row.code, row.taxIndicator]));
  const products = await repository.findActiveProductsByCabysCodes(diff.taxIndicatorChangedCodes);

  const productsToReview: ProductToReview[] = [];
  for (const product of products) {
    if (!product.cabysCode) continue;

    const officialRate = interpretOfficialTaxRate(newIndicatorByCode.get(product.cabysCode) ?? null);
    const currentRate = Number(product.tax.rate);

    if (officialRate !== null && officialRate !== currentRate) {
      productsToReview.push({
        productId: product.id,
        productName: product.name,
        cabysCode: product.cabysCode,
        currentTaxName: product.tax.name,
        currentTaxRate: currentRate,
        officialTaxRate: officialRate,
      });
    }
  }

  return productsToReview;
}

/** Compara dos diffs por CONTENIDO (no por referencia) — usado por BLOQUE
 * 3 para detectar si el catalogo cambio entre el momento de la vista
 * previa y el de la aplicacion. Los conjuntos involucrados son siempre el
 * subconjunto de codigos que cambian (nunca las ~20 500 filas completas),
 * asi que serializar y comparar es barato. */
function diffsAreEquivalent(a: DiffResult, b: DiffResult): boolean {
  const serialize = (diff: DiffResult) =>
    JSON.stringify({
      toCreate: [...diff.toCreate].sort((x, y) => x.code.localeCompare(y.code)),
      toUpdate: [...diff.toUpdate].sort((x, y) => x.code.localeCompare(y.code)),
      toRetire: [...diff.toRetire].sort(),
    });

  return serialize(a) === serialize(b);
}

/** Aplica el diff identificado por `previewToken`, pero NUNCA a ciegas
 * (BLOQUE 3): recalcula el diff contra el estado ACTUAL de `CabysCode`
 * justo antes de aplicar y compara contra el diff que se le mostro al
 * usuario en la vista previa. Si difieren — alguien mas actualizo el
 * catalogo mientras tanto (otra pestaña, el script de terminal, etc.) — se
 * cancela con un `ValidationError` claro en vez de aplicar un diff
 * obsoleto. Tambien actualiza el estado de sincronizacion, registra el
 * evento en `AuditLog` y genera el reporte informativo de productos a
 * revisar — sin modificar ningun producto. */
export async function applyUpdate(params: {
  previewToken: string;
  userId: string;
  sucursalId: string;
}): Promise<ApplyCatalogUpdateResult> {
  cleanupExpiredPreviews();

  const pending = pendingPreviews.get(params.previewToken);
  if (!pending) {
    throw new ValidationError(
      'La vista previa expiró o no existe. Volvé a "Buscar actualizaciones" para generar una nueva.',
    );
  }
  pendingPreviews.delete(params.previewToken);

  const freshDiff = await computeDiff(pending.fileRows);
  if (!diffsAreEquivalent(pending.diff, freshDiff)) {
    throw new ValidationError(
      'El catálogo cambió desde que se generó la vista previa. Busque actualizaciones nuevamente.',
    );
  }

  await applyDiff(freshDiff);

  const recordCount = await repository.countActiveCodes();
  await repository.upsertSyncState({
    lastEtag: pending.remote.etag,
    lastModified: pending.remote.lastModified,
    lastSyncedAt: new Date(),
    recordCount,
  });

  const summary = toSummary(freshDiff);

  await auditService.log({
    action: AuditAction.UPDATE,
    entity: 'CabysCatalogSync',
    userId: params.userId,
    sucursalId: params.sucursalId,
    after: summary as unknown as Record<string, unknown>,
    metadata: {
      remoteEtag: pending.remote.etag,
      remoteLastModified: pending.remote.lastModified,
    },
  });

  const productsToReview = await buildProductsToReviewReport(freshDiff);

  return { summary, productsToReview };
}
