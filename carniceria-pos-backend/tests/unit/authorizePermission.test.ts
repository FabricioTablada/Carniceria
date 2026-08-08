/**
 * tests/unit/authorizePermission.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 2. Cubre `authorizePermission` (middlewares/authorize.middleware.ts),
 * el UNICO mecanismo de autorizacion que protege todos los endpoints
 * priorizados de este sprint: `sales.void`, `sales.correct`, `returns.create`,
 * `inventory.waste`, `inventory.adjust`. Probarlo una vez cubre el patron de
 * permisos usado por los 5 flujos criticos.
 *
 * `rolesService.hasPermission` se mockea: este middleware no accede a Prisma
 * directamente (ver comentario del archivo fuente), asi que no hace falta
 * una base de datos real para probar su logica de decision.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '@/shared/errors';

vi.mock('@/modules/roles/roles.service', () => ({
  hasPermission: vi.fn(),
}));

import * as rolesService from '@/modules/roles/roles.service';
import { authorizePermission } from '@/middlewares/authorize.middleware';

function createMockReq(user?: { role: string }): Request {
  return { user } as unknown as Request;
}

describe('authorizePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lanza UnauthorizedError si no hay usuario autenticado', () => {
    const middleware = authorizePermission('sales.void');
    const next = vi.fn();

    expect(() => middleware(createMockReq(undefined), {} as Response, next)).toThrow(
      UnauthorizedError,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('llama a next() cuando el rol tiene el permiso requerido', async () => {
    vi.mocked(rolesService.hasPermission).mockResolvedValue(true);

    const middleware = authorizePermission('sales.void');
    const next: NextFunction = vi.fn();
    middleware(createMockReq({ role: 'ADMIN' }), {} as Response, next);

    // hasPermission() es async (Promise), esperar el microtask antes de verificar.
    await new Promise((resolve) => setImmediate(resolve));

    expect(rolesService.hasPermission).toHaveBeenCalledWith('ADMIN', ['sales.void']);
    expect(next).toHaveBeenCalledWith();
  });

  it('propaga ForbiddenError via next(error) cuando el rol NO tiene el permiso', async () => {
    vi.mocked(rolesService.hasPermission).mockResolvedValue(false);

    const middleware = authorizePermission('inventory.waste');
    const next: NextFunction = vi.fn();
    middleware(createMockReq({ role: 'CASHIER' }), {} as Response, next);

    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
  });

  it('propaga cualquier error de rolesService.hasPermission via next(error), sin lanzarlo directo', async () => {
    const dbError = new Error('conexion perdida');
    vi.mocked(rolesService.hasPermission).mockRejectedValue(dbError);

    const middleware = authorizePermission('inventory.adjust');
    const next: NextFunction = vi.fn();
    middleware(createMockReq({ role: 'MANAGER' }), {} as Response, next);

    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(dbError);
  });

  it('concede acceso si el rol tiene AL MENOS UNO de varios permisos indicados', async () => {
    vi.mocked(rolesService.hasPermission).mockResolvedValue(true);

    const middleware = authorizePermission('sales.void', 'sales.correct');
    const next: NextFunction = vi.fn();
    middleware(createMockReq({ role: 'MANAGER' }), {} as Response, next);

    await new Promise((resolve) => setImmediate(resolve));

    expect(rolesService.hasPermission).toHaveBeenCalledWith('MANAGER', [
      'sales.void',
      'sales.correct',
    ]);
    expect(next).toHaveBeenCalledWith();
  });
});
