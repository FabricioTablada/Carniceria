/**
 * modules/index.ts
 * -----------------------------------------------------------------------------
 * Registro central de módulos.
 *
 * Fase 19 (Bloque 19.4): la asignación de políticas de Rate Limiting ya NO
 * vive aquí. Tras la revisión arquitectónica del Bloque 19.3, atarla al
 * punto de montaje del router obligaba a que todo un módulo compartiera un
 * único perfil de trafico, aunque internamente mezclara operaciones de
 * distinta naturaleza (ej. `inventory`: alta administrativa, lecturas de
 * consulta y ajustes transaccionales, todos bajo el mismo prefijo). Cada
 * endpoint declara ahora su propia política directamente en su
 * `routes.ts`, junto a `authenticate`/`authorizePermission` — mismo patrón
 * ya usado por esos dos middlewares transversales (ver
 * `middlewares/rateLimit.middleware.ts` para las instancias centralizadas).
 */

import { Router } from 'express';

import { auditRoutes } from './audit';
import { authRoutes } from './auth';
import { cabysRoutes } from './cabys';
import { cashRoutes } from './cash';
import { cashRegisterRoutes } from './cashRegister';
import { categoriesRoutes } from './categories';
import { configurationRoutes } from './configuration';
import { customersRoutes } from './customers';
import { documentsRoutes } from './documents';
import { alegraRoutes } from './integrations/alegra';
import { inventoryRoutes } from './inventory';
import { notificationsRoutes } from './notifications';
import { permissionsRoutes } from './permissions';
import { processingRoutes } from './processing';
import { productsRoutes } from './products';
import { promotionsRoutes } from './promotions';
import { purchaseRoutes } from './purchases';
import { reportsRoutes } from './reports';
import { returnsRoutes } from './returns';
import { rolesRoutes } from './roles';
import { salesRoutes } from './sales';
import { suppliersRoutes } from './suppliers';
import { taxesRoutes } from './taxes';
import { usersRoutes } from './users';

export const modulesRouter = Router();

modulesRouter.use('/auth', authRoutes);
modulesRouter.use('/users', usersRoutes);
modulesRouter.use('/roles', rolesRoutes);
modulesRouter.use('/permissions', permissionsRoutes);
modulesRouter.use('/categories', categoriesRoutes);
modulesRouter.use('/cabys', cabysRoutes);
modulesRouter.use('/products', productsRoutes);
modulesRouter.use('/taxes', taxesRoutes);
modulesRouter.use('/promotions', promotionsRoutes);
modulesRouter.use('/suppliers', suppliersRoutes);
modulesRouter.use('/customers', customersRoutes);
modulesRouter.use('/inventory', inventoryRoutes);
modulesRouter.use('/purchases', purchaseRoutes);
modulesRouter.use('/processing', processingRoutes);
modulesRouter.use('/sales', salesRoutes);
modulesRouter.use('/documents', documentsRoutes);
modulesRouter.use('/returns', returnsRoutes);
modulesRouter.use('/cash-registers', cashRegisterRoutes);
modulesRouter.use('/cash', cashRoutes);
modulesRouter.use('/reports', reportsRoutes);
modulesRouter.use('/notifications', notificationsRoutes);
modulesRouter.use('/configuration', configurationRoutes);
modulesRouter.use('/integrations/alegra', alegraRoutes);
modulesRouter.use('/audit', auditRoutes);
