/**
 * tests/unit/returns.authorization.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 3.1. Cubre la correccion de autorizacion de `POST /returns`
 * (modules/returns/controller.ts) detectada en la auditoria de Sprint QA 3:
 * una devolucion con `restock: false` en al menos una linea produce el mismo
 * efecto de negocio que una merma (el producto no reingresa al inventario),
 * pero solo exigia `returns.create` — nunca `inventory.waste`, el permiso
 * que gobierna esa misma decision desde Inventario.
 *
 * Regla verificada:
 *  - Todas las lineas con `restock: true` (o sin `restock`, default): solo
 *    exige `returns.create` (ya cubierto por la ruta via
 *    `authorizePermission`, no se llama a `rolesService.hasPermission` de
 *    nuevo).
 *  - Al menos una linea con `restock: false`: exige ADEMAS `inventory.waste`.
 *    Sin ese permiso, se rechaza con `ForbiddenError` ANTES de invocar
 *    `returnsService.createReturn` (el backend es la autoridad final, no
 *    solo el frontend).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { ForbiddenError } from '@/shared/errors';

vi.mock('@/modules/roles/roles.service', () => ({
  hasPermission: vi.fn(),
}));

vi.mock('@/modules/returns/service', () => ({
  createReturn: vi.fn().mockResolvedValue({ id: 'return-1' }),
}));

import * as rolesService from '@/modules/roles/roles.service';
import * as returnsService from '@/modules/returns/service';
import { create } from '@/modules/returns/controller';

function buildReq(items: Array<{ saleItemId: string; quantity: number; restock?: boolean }>): Request {
  return {
    body: {
      saleId: '11111111-1111-1111-1111-111111111111',
      cashSessionId: '22222222-2222-2222-2222-222222222222',
      reason: 'Cliente no quedó satisfecho',
      refundMethod: 'CASH',
      items,
    },
    user: { id: 'user-1', role: 'CASHIER', sucursalId: 'sucursal-1' },
  } as unknown as Request;
}

function buildRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('POST /returns — autorizacion condicional por restock (Sprint QA 3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('con todas las lineas restock=true, NO vuelve a consultar permisos (solo returns.create, ya exigido por la ruta)', async () => {
    const req = buildReq([{ saleItemId: '33333333-3333-3333-3333-333333333333', quantity: 2, restock: true }]);
    const res = buildRes();
    const next = vi.fn();

    create(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(rolesService.hasPermission).not.toHaveBeenCalled();
    expect(returnsService.createReturn).toHaveBeenCalledTimes(1);
  });

  it('con restock por defecto (sin indicarlo), tampoco exige inventory.waste', async () => {
    const req = buildReq([{ saleItemId: '33333333-3333-3333-3333-333333333333', quantity: 2 }]);
    const res = buildRes();
    const next = vi.fn();

    create(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(rolesService.hasPermission).not.toHaveBeenCalled();
    expect(returnsService.createReturn).toHaveBeenCalledTimes(1);
  });

  it('con una linea restock=false y el rol SIN inventory.waste, rechaza con ForbiddenError y NO llama a createReturn', async () => {
    vi.mocked(rolesService.hasPermission).mockResolvedValue(false);
    const req = buildReq([{ saleItemId: '33333333-3333-3333-3333-333333333333', quantity: 2, restock: false }]);
    const res = buildRes();
    const next = vi.fn();

    create(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(rolesService.hasPermission).toHaveBeenCalledWith('CASHIER', ['inventory.waste']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
    expect(returnsService.createReturn).not.toHaveBeenCalled();
  });

  it('con una linea restock=false y el rol SI tiene inventory.waste, permite la devolucion', async () => {
    vi.mocked(rolesService.hasPermission).mockResolvedValue(true);
    const req = buildReq([{ saleItemId: '33333333-3333-3333-3333-333333333333', quantity: 2, restock: false }]);
    const res = buildRes();
    const next = vi.fn();

    create(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(rolesService.hasPermission).toHaveBeenCalledWith('CASHIER', ['inventory.waste']);
    expect(next).not.toHaveBeenCalled();
    expect(returnsService.createReturn).toHaveBeenCalledTimes(1);
  });

  it('mezcla de lineas (una restock=true, otra restock=false): igual exige inventory.waste', async () => {
    vi.mocked(rolesService.hasPermission).mockResolvedValue(false);
    const req = buildReq([
      { saleItemId: '33333333-3333-3333-3333-333333333333', quantity: 1, restock: true },
      { saleItemId: '44444444-4444-4444-4444-444444444444', quantity: 1, restock: false },
    ]);
    const res = buildRes();
    const next = vi.fn();

    create(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(rolesService.hasPermission).toHaveBeenCalledWith('CASHIER', ['inventory.waste']);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
    expect(returnsService.createReturn).not.toHaveBeenCalled();
  });
});
