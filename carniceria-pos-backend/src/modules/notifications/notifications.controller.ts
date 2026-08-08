/**
 * modules/notifications/notifications.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del Centro de Notificaciones. Solo invoca
 * `notifications.service.ts` y responde con el formato estandar de la API;
 * no contiene logica de negocio ni accede a Prisma.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { HttpStatus } from '@/shared/constants';
import * as notificationsService from './notifications.service';

/** GET /notifications
 * Sin `meta` de paginacion: es una foto del estado actual del sistema
 * (alertas), no un listado paginado (mismo criterio que
 * `GET /reports/low-stock`). */
export const getNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const result = await notificationsService.getNotifications();

  res.status(HttpStatus.OK).json(success(result));
});
