/**
 * middlewares/errorHandler.middleware.ts
 * -----------------------------------------------------------------------------
 * Manejador GLOBAL de errores. Es el ultimo middleware de la cadena. Traduce
 * cualquier error (de dominio o inesperado) a una respuesta HTTP consistente.
 *
 * - Errores operacionales (AppError): se exponen con su mensaje y codigo.
 * - Errores de validacion (ZodError): se traducen a 400, con los issues de
 *   Zod como detalle. Es una traduccion GLOBAL, unica para todo el backend:
 *   ningun controlador captura ZodError por su cuenta (todos hacen
 *   `Schema.parse(req.query)` y dejan que `asyncHandler` reenvie la
 *   excepcion hasta aqui), asi que este es el unico lugar donde corresponde
 *   resolverlo.
 * - Errores inesperados: se registran completos, pero al cliente solo se le
 *   devuelve un mensaje generico (no se filtran detalles internos).
 * - Errores de `multer` (Bloque 10, subida de imagen de producto): se
 *   traducen a 422 con un mensaje legible — sin este caso, un archivo que
 *   supera `PRODUCT_IMAGE_MAX_SIZE_MB` caeria en el branch generico de 500
 *   ("error interno"), un mensaje enganoso para algo que es, en realidad,
 *   un dato de entrada invalido.
 *
 * Hallazgo de seguridad #6 (auditoria 31/07/2026): todo `ForbiddenError`
 * (403) que llega aca se registra ademas en `AuditLog` como
 * `ACCESS_DENIED` — es el unico punto por el que pasan TODAS las
 * denegaciones de autorizacion del backend (`authorize`/`authorizePermission`
 * y las reglas de negocio que lanzan `ForbiddenError` directamente), asi
 * que centralizar el registro aca cubre el caso general sin tocar cada
 * punto de autorizacion por separado. Se dispara sin esperar (`void ...
 * .catch(...)`) para no demorar ni condicionar la respuesta HTTP al
 * cliente ante una falla puntual de auditoria.
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { logger, isProduction, PRODUCT_IMAGE_MAX_SIZE_MB } from '@/config';
import { AppError, ForbiddenError } from '@/shared/errors';
import { failure } from '@/shared/utils';
import { HttpStatus, AuditAction } from '@/shared/constants';
import { auditService } from '@/shared/services/audit.service';

function logAccessDenied(error: ForbiddenError, req: Request): void {
  if (!req.user) {
    // No deberia ocurrir hoy (todo `ForbiddenError` actual se lanza
    // despues de confirmar `req.user`), pero sin sucursalId no hay donde
    // atribuir el registro — se omite en vez de forzar un valor incorrecto.
    return;
  }

  void auditService
    .log({
      action: AuditAction.ACCESS_DENIED,
      entity: 'authorization',
      userId: req.user.id,
      sucursalId: req.user.sucursalId,
      ip: req.ip,
      metadata: { method: req.method, path: req.originalUrl, message: error.message },
    })
    .catch((auditError: unknown) => {
      logger.error({ err: auditError }, 'No se pudo registrar ACCESS_DENIED en AuditLog');
    });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // El 4to parametro es obligatorio para que Express reconozca este middleware
  // como manejador de errores, aunque no se use.
  _next: NextFunction,
): void {
  if (error instanceof AppError && error.isOperational) {
    logger.warn({ err: error }, error.message);

    if (error instanceof ForbiddenError) {
      logAccessDenied(error, req);
    }

    res.status(error.statusCode).json(failure(error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    logger.warn({ err: error }, 'Error de validacion');
    res
      .status(HttpStatus.BAD_REQUEST)
      .json(failure('VALIDATION_ERROR', 'Datos de entrada invalidos.', error.issues));
    return;
  }

  if (error instanceof multer.MulterError) {
    logger.warn({ err: error }, 'Error de carga de archivo');
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `El archivo supera el tamaño máximo permitido (${PRODUCT_IMAGE_MAX_SIZE_MB}MB).`
        : 'No se pudo procesar el archivo enviado.';
    res.status(HttpStatus.UNPROCESSABLE_ENTITY).json(failure('VALIDATION_ERROR', message, { code: error.code }));
    return;
  }

  logger.error({ err: error }, 'Error no controlado');

  res
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .json(
      failure(
        'INTERNAL_ERROR',
        'Ocurrio un error interno.',
        isProduction ? undefined : String(error),
      ),
    );
}
