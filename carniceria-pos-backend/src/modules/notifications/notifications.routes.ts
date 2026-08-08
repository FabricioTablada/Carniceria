/**
 * modules/notifications/notifications.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del módulo Notifications.
 */

import { Router } from 'express';
import { authenticate, authorizePermission, reportsRateLimiter } from '@/middlewares';

import { getNotifications } from './notifications.controller';

export const notificationsRoutes = Router();

notificationsRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getNotifications,
);
