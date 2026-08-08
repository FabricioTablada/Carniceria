/**
 * middlewares/audit.middleware.ts
 * -----------------------------------------------------------------------------
 * Middleware auxiliar para registrar acciones auditables a nivel HTTP
 * (p.ej. login/logout). Para la mayoria de acciones de dominio, la auditoria se
 * dispara desde los services mediante `auditService.log(...)`.
 *
 * Uso futuro: audit(AuditAction.LOGIN, 'auth') en la ruta correspondiente.
 */
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/config';
import { auditService } from '@/shared/services/audit.service';
import type { AuditActionName } from '@/shared/constants';

export function audit(action: AuditActionName, entity: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      // Solo audita respuestas exitosas (2xx).
      if (res.statusCode >= 200 && res.statusCode < 300) {
        auditService
          .log({
            action,
            entity,
            userId: req.user?.id,
            sucursalId: req.user?.sucursalId,
            ip: req.ip,
          })
          .catch((error: unknown) => {
            logger.error({ err: error, action, entity }, 'AUDIT_LOG_FAILED');
          });
      }
    });
    next();
  };
}
