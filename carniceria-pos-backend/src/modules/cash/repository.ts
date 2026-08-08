/**
 * modules/cash/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de caja.
 * Es infraestructura pura: no valida datos de entrada y no contiene reglas
 * de negocio (eso vive en `cash.service.ts`). Usa unicamente la instancia
 * singleton de Prisma expuesta en `@/database`.
 *
 * Las consultas se organizan en tres secciones por responsabilidad:
 * validaciones de existencia compartidas, `CashSession` y `CashMovement`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `CashSession` y `CashMovement`
 * se registren en `SOFT_DELETE_MODELS`.
 *
 * NOTA: ni `CashSession` ni `CashMovement` tienen restriccion `@@unique` en
 * `schema.prisma`, por lo que este repositorio no expone un finder de
 * duplicados (a diferencia de Categories, Products, Taxes, Suppliers,
 * Inventory y Sales).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListCashMovementsFilters, ListCashSessionsFilters } from './types';

// ---------------------------------------------------------------------------
// Validaciones de existencia compartidas
// ---------------------------------------------------------------------------

/** Verifica la existencia de la sucursal referenciada. */
export function findSucursalById(id: string) {
  return prisma.sucursal.findFirst({
    where: { id },
    select: { id: true },
  });
}

/** Verifica la existencia del usuario referenciado. */
export function findUserById(id: string, db: DbClient = prisma) {
  return db.user.findFirst({
    where: { id },
    select: { id: true },
  });
}

/** Verifica la existencia de la caja registradora referenciada. */
export function findCashRegisterById(id: string) {
  return prisma.cashRegister.findFirst({
    where: { id },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// CashSession: sesiones de caja
// ---------------------------------------------------------------------------

/** Incluye los resumenes de sucursal y de los usuarios que abren/cierran
 * la sesion. */
const sessionWithRelationsInclude = {
  sucursal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  openedBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  closedBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
} as const;

export function createSession(data: Prisma.CashSessionUncheckedCreateInput) {
  return prisma.cashSession.create({
    data,
    include: sessionWithRelationsInclude,
  });
}

export function findSessionById(id: string, db: DbClient = prisma) {
  return db.cashSession.findFirst({
    where: { id },
    include: sessionWithRelationsInclude,
  });
}

/** Busca una sesion de caja abierta para una caja registradora. Se usa para
 * evitar dos sesiones abiertas simultaneamente sobre la misma caja. */
export function findOpenSessionByCashRegister(cashRegisterId: string) {
  return prisma.cashSession.findFirst({
    where: { cashRegisterId, status: 'OPEN' },
    select: { id: true },
  });
}

/** Suma `total` (el monto neto que la venta retiene en caja, ya que
 * `total = amountPaid - changeGiven`) de las ventas completadas en
 * efectivo (`paymentMethod = CASH`, `status = COMPLETED`) de una sesion de
 * caja. Se usa junto con `sumMovementsByType` para calcular el efectivo
 * esperado al cerrar la sesion. Se mantiene aqui, y no se duplica el
 * acceso a `Sale` en otro archivo, porque es una lectura de agregacion
 * especifica para este calculo (mismo patron ya usado en Purchases/Sales
 * al consultar Product/Tax directamente desde su propio repositorio). Las
 * ventas `CANCELLED` o `REFUNDED` se excluyen: ese efectivo ya no
 * corresponde a la caja.
 *
 * NOTA: se agrega `total`, no `amountPaid`. `amountPaid` es el monto
 * bruto que el cliente entrego (antes del vuelto); el efectivo que
 * realmente permanece en caja es `amountPaid - changeGiven`, que equivale
 * a `total` (ver `sales.service.ts`: `changeGiven = amountPaid - total`).
 * Sumar `amountPaid` directamente infla el efectivo esperado por el monto
 * de vuelto entregado en cada venta. */
export function sumCashSalesAmount(cashSessionId: string, db: DbClient = prisma) {
  return db.sale.aggregate({
    where: { cashSessionId, paymentMethod: 'CASH', status: 'COMPLETED' },
    _sum: { total: true },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado de
 * sesiones de caja. */
function buildSessionWhere(filters?: ListCashSessionsFilters): Prisma.CashSessionWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    cashRegisterId: filters.cashRegisterId,
    status: filters.status,
  };
}

export function findSessions(params: {
  skip: number;
  take: number;
  filters?: ListCashSessionsFilters;
}) {
  const where = buildSessionWhere(params.filters);

  return prisma.$transaction([
    prisma.cashSession.findMany({
      where,
      include: sessionWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cashSession.count({ where }),
  ]);
}

export function updateSession(
  id: string,
  data: Prisma.CashSessionUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.cashSession.update({
    where: { id },
    data,
    include: sessionWithRelationsInclude,
  });
}

/**
 * Auditoria de riesgos criticos (Hallazgo 5, 07/08/2026): cierre de sesion
 * ATOMICO -- a diferencia de `updateSession` (arriba, usado tambien para
 * ediciones genéricas como `notes`, sin cambios), esta funcion condiciona
 * la escritura a `status: 'OPEN'` en la MISMA sentencia `UPDATE`, mismo
 * principio ya usado en `modules/inventory/repository.ts::reserveIfSufficient`
 * (verificar + escribir en un solo paso atomico, sin depender de una
 * lectura previa por separado). Devuelve `{ count: 0 }` si la sesion ya
 * no estaba `OPEN` en el momento exacto de la escritura -- `closeSession`
 * (`cash/service.ts`) trata eso como "ya fue cerrada por otra operacion",
 * sin sobreescribir nada. Uso exclusivo de `closeSession`; no reemplaza a
 * `updateSession` para ningun otro flujo.
 */
export function closeSessionIfOpen(
  id: string,
  data: Prisma.CashSessionUncheckedUpdateInput,
  db: DbClient,
) {
  return db.cashSession.updateMany({
    where: { id, status: 'OPEN' },
    data,
  });
}

// ---------------------------------------------------------------------------
// CashMovement: movimientos de caja
// ---------------------------------------------------------------------------

/** Incluye los resumenes de sucursal y usuario asociados al movimiento. */
const movementWithRelationsInclude = {
  sucursal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
      fullName: true,
    },
  },
} as const;

export function createMovement(data: Prisma.CashMovementUncheckedCreateInput) {
  return prisma.cashMovement.create({
    data,
    include: movementWithRelationsInclude,
  });
}

export function findMovementById(id: string) {
  return prisma.cashMovement.findFirst({
    where: { id },
    include: movementWithRelationsInclude,
  });
}

/** Suma el monto de los movimientos de una sesion, agrupados por tipo. Se
 * usa para calcular el efectivo esperado al cerrar la sesion. */
export function sumMovementsByType(cashSessionId: string, db: DbClient = prisma) {
  return db.cashMovement.groupBy({
    by: ['type'],
    where: { cashSessionId },
    _sum: { amount: true },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado de
 * movimientos de caja. */
function buildMovementWhere(filters?: ListCashMovementsFilters): Prisma.CashMovementWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    cashSessionId: filters.cashSessionId,
    userId: filters.userId,
    type: filters.type,
  };
}

export function findMovements(params: {
  skip: number;
  take: number;
  filters?: ListCashMovementsFilters;
}) {
  const where = buildMovementWhere(params.filters);

  return prisma.$transaction([
    prisma.cashMovement.findMany({
      where,
      include: movementWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cashMovement.count({ where }),
  ]);
}
