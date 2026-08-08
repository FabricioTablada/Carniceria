/**
 * modules/cash/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de caja.
 *
 * El modulo agrupa dos agregados de `schema.prisma` (`CashSession` y
 * `CashMovement`), pero su logica se mantiene claramente separada en tres
 * secciones: (1) sesiones de caja, (2) movimientos de caja, y (3) helpers
 * privados de validacion/calculo compartidos entre ambas.
 *
 * Responsabilidades:
 *  - Apertura de sesion de caja: valida sucursal, caja registradora y
 *    usuario, y evita abrir una sesion si la caja registradora ya tiene
 *    otra sesion abierta.
 *  - Consulta de sesiones (por ID y listado paginado).
 *  - Actualizacion de sesiones: solo el campo `notes`; los datos de
 *    apertura no se editan una vez creada la sesion.
 *  - Cierre de sesion de caja: valida que la sesion exista y este abierta,
 *    y calcula `expectedAmount` y `difference` a partir de `openingAmount`,
 *    los movimientos de caja registrados y las ventas en efectivo de la
 *    sesion. El cliente nunca envia estos dos valores (mismo patron
 *    aprobado en Purchases/Sales: el backend nunca confia en importes
 *    calculados por el cliente).
 *  - Registro de movimientos de caja: valida sucursal, usuario, y que la
 *    sesion exista y este abierta.
 *  - Consulta de movimientos (por ID y listado paginado).
 *  - Traducir los registros de Prisma a las formas publicas
 *    `CashSessionResponse` y `CashMovementResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de `cash.repository.ts`;
 * este servicio no ejecuta queries de Prisma directamente.
 *
 * NOTA sobre `expectedAmount`: se calcula a partir de `openingAmount`, los
 * movimientos de caja (`CashMovement`) registrados en este modulo, y el
 * `total` (monto neto que permanece en caja, `total = amountPaid -
 * changeGiven`) de las ventas completadas en efectivo (`Sale` con
 * `paymentMethod = CASH` y `status = COMPLETED`) de la sesion. Una venta en
 * efectivo NO genera un `CashMovement` automatico: `CashMovement`
 * representa exclusivamente ingresos/egresos manuales (retiros, aportes,
 * gastos menores), no ventas (ver DATABASE.md, seccion `cash_movements`,
 * "No confundir con ventas"). Contarlas ademas como `CashMovement`
 * duplicaria el mismo hecho economico en dos tablas.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { transactionConfig } from '@/config';
import { ConflictError, NotFoundError } from '@/shared/errors';
import { toMoney, type Money } from '@/shared/utils/money';
import * as cashRepository from './repository';
import type {
  CashMovementResponse,
  CashMovementType,
  CashSessionResponse,
  CashSessionStatus,
  CloseCashSessionDto,
  CreateCashMovementDto,
  ListCashMovementsQuery,
  ListCashMovementsResult,
  ListCashSessionsQuery,
  ListCashSessionsResult,
  OpenCashSessionDto,
  UpdateCashSessionDto,
} from './types';

/** Forma minima que debe tener el registro de sesion de caja de Prisma para
 * poder mapearlo. */
type CashSessionRecord = {
  id: string;
  sucursalId: string;
  cashRegisterId: string;
  status: string;
  openedByUserId: string;
  openedAt: Date;
  openingAmount: Prisma.Decimal;
  closedByUserId: string | null;
  closedAt: Date | null;
  closingAmount: Prisma.Decimal | null;
  expectedAmount: Prisma.Decimal | null;
  difference: Prisma.Decimal | null;
  notes: string | null;
  sucursal: { id: string; code: string; name: string };
  openedBy: { id: string; fullName: string };
  closedBy: { id: string; fullName: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Forma minima que debe tener el registro de movimiento de caja de Prisma
 * para poder mapearlo. */
type CashMovementRecord = {
  id: string;
  sucursalId: string;
  cashSessionId: string;
  userId: string;
  type: string;
  amount: Prisma.Decimal;
  reason: string;
  sucursal: { id: string; code: string; name: string };
  user: { id: string; fullName: string };
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica de la sesion de caja. */
function toCashSessionResponse(session: CashSessionRecord): CashSessionResponse {
  return {
    id: session.id,
    sucursalId: session.sucursalId,
    cashRegisterId: session.cashRegisterId,
    status: session.status as CashSessionStatus,
    openedByUserId: session.openedByUserId,
    openedAt: session.openedAt,
    openingAmount: Number(session.openingAmount),
    closedByUserId: session.closedByUserId,
    closedAt: session.closedAt,
    closingAmount: session.closingAmount === null ? null : Number(session.closingAmount),
    expectedAmount: session.expectedAmount === null ? null : Number(session.expectedAmount),
    difference: session.difference === null ? null : Number(session.difference),
    notes: session.notes,
    sucursal: session.sucursal,
    openedBy: session.openedBy,
    closedBy: session.closedBy,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/** Traduce un registro de Prisma a la forma publica del movimiento de caja. */
function toCashMovementResponse(movement: CashMovementRecord): CashMovementResponse {
  return {
    id: movement.id,
    sucursalId: movement.sucursalId,
    cashSessionId: movement.cashSessionId,
    userId: movement.userId,
    type: movement.type as CashMovementType,
    amount: Number(movement.amount),
    reason: movement.reason,
    sucursal: movement.sucursal,
    user: movement.user,
    createdAt: movement.createdAt,
    updatedAt: movement.updatedAt,
  };
}

/**
 * Calcula el efectivo esperado en una sesion de caja: fondo inicial mas
 * ingresos (`CASH_IN`) menos egresos (`CASH_OUT`) menos reembolsos en
 * efectivo (`REFUND`, ver nota de Sprint QA 1 mas abajo) registrados como
 * movimientos de caja, mas el `total` (monto neto retenido en caja) de las
 * ventas completadas en efectivo de la sesion. Las ventas en efectivo no
 * generan un `CashMovement`: se leen directamente de `Sale` para evitar
 * duplicar el
 * mismo hecho economico en dos tablas.
 *
 * Sprint QA 1 (fix de datos incorrectos en Caja): `CashMovementType.REFUND`
 * (agregado en el Bloque 4.2, para el reembolso en efectivo de una
 * devolucion) ya se registraba correctamente en `CashMovement`, pero esta
 * funcion solo leia `CASH_IN`/`CASH_OUT` de `sums` — un reembolso en
 * efectivo SI existia en la base de datos pero NUNCA se restaba de
 * `expectedAmount`. Efecto real: el efectivo esperado quedaba
 * sobrestimado exactamente en el monto de cada reembolso, y al cerrar la
 * caja (contando el efectivo real, correctamente MENOR por el reembolso ya
 * entregado) el sistema reportaba un "faltante" que en realidad no era un
 * error de caja, sino un reembolso nunca restado del calculo.
 *
 * Exportada (Sprint QA 2, unico motivo del cambio de visibilidad — cero
 * cambio de logica) para poder probar este calculo directamente en
 * `tests/unit/cash.expectedAmount.test.ts`, como regresion del fix de
 * Sprint QA 1 de arriba.
 */
export async function computeExpectedAmount(
  cashSessionId: string,
  openingAmount: Prisma.Decimal,
  db: DbClient,
): Promise<Money> {
  const sums = await cashRepository.sumMovementsByType(cashSessionId, db);

  const cashInSum = sums.find((entry) => entry.type === 'CASH_IN')?._sum.amount;
  const cashOutSum = sums.find((entry) => entry.type === 'CASH_OUT')?._sum.amount;
  const refundSum = sums.find((entry) => entry.type === 'REFUND')?._sum.amount;

  const cashIn = cashInSum ? toMoney(cashInSum) : toMoney(0);
  const cashOut = cashOutSum ? toMoney(cashOutSum) : toMoney(0);
  const refund = refundSum ? toMoney(refundSum) : toMoney(0);

  const cashSales = await cashRepository.sumCashSalesAmount(cashSessionId, db);
  const cashSalesTotal = cashSales._sum.total ? toMoney(cashSales._sum.total) : toMoney(0);

  return toMoney(openingAmount).add(cashIn).sub(cashOut).sub(refund).add(cashSalesTotal);
}

// ---------------------------------------------------------------------------
// CashSession: sesiones de caja
// ---------------------------------------------------------------------------

export async function openSession(dto: OpenCashSessionDto): Promise<CashSessionResponse> {
  const sucursal = await cashRepository.findSucursalById(dto.sucursalId);

  if (!sucursal) {
    throw new NotFoundError('Sucursal');
  }

  const cashRegister = await cashRepository.findCashRegisterById(dto.cashRegisterId);

  if (!cashRegister) {
    throw new NotFoundError('Caja registradora');
  }

  const openedBy = await cashRepository.findUserById(dto.openedByUserId);

  if (!openedBy) {
    throw new NotFoundError('Usuario');
  }

  const openSessionForRegister = await cashRepository.findOpenSessionByCashRegister(
    dto.cashRegisterId,
  );

  if (openSessionForRegister) {
    throw new ConflictError('Ya existe una sesion de caja abierta para esta caja registradora.');
  }

  const created = await cashRepository.createSession({
    sucursalId: dto.sucursalId,
    cashRegisterId: dto.cashRegisterId,
    openedByUserId: dto.openedByUserId,
    openingAmount: dto.openingAmount,
    notes: dto.notes ?? null,
  });

  return toCashSessionResponse(created);
}

export async function findSessionById(id: string): Promise<CashSessionResponse> {
  const session = await cashRepository.findSessionById(id);

  if (!session) {
    throw new NotFoundError('Sesion de caja');
  }

  return toCashSessionResponse(session);
}

export async function findSessions(query: ListCashSessionsQuery): Promise<ListCashSessionsResult> {
  const [items, total] = await cashRepository.findSessions({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toCashSessionResponse(item)),
    total,
  };
}

export async function updateSession(
  id: string,
  dto: UpdateCashSessionDto,
): Promise<CashSessionResponse> {
  const existing = await cashRepository.findSessionById(id);

  if (!existing) {
    throw new NotFoundError('Sesion de caja');
  }

  const updated = await cashRepository.updateSession(id, {
    notes: dto.notes,
  });

  return toCashSessionResponse(updated);
}

export async function closeSession(
  id: string,
  dto: CloseCashSessionDto,
  closedByUserId: string,
): Promise<CashSessionResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await cashRepository.findSessionById(id, tx);

    if (!existing) {
      throw new NotFoundError('Sesion de caja');
    }

    if (existing.status !== 'OPEN') {
      throw new ConflictError('La sesion de caja ya se encuentra cerrada.');
    }

    const closedBy = await cashRepository.findUserById(closedByUserId, tx);

    if (!closedBy) {
      throw new NotFoundError('Usuario');
    }

    const expectedAmount = await computeExpectedAmount(id, existing.openingAmount, tx);
    const closingAmount = toMoney(dto.closingAmount);
    const difference = closingAmount.sub(expectedAmount);

    // Auditoria de riesgos criticos (Hallazgo 5, 07/08/2026): la lectura de
    // `existing.status` de arriba, por si sola, no impide que dos cierres
    // casi simultaneos para la misma sesion pasen ambos esa validacion
    // antes de que cualquiera confirme (mismo patron de condicion de
    // carrera ya corregido en el Bloque 1 para Devoluciones/Compras/
    // Mermas). `closeSessionIfOpen` condiciona la escritura a `status:
    // 'OPEN'` en la misma sentencia -- si otra transaccion ya cerro esta
    // sesion mientras tanto, `count` da 0 y se aborta con el mismo
    // error funcional, sin sobreescribir el cierre ya realizado.
    const result = await cashRepository.closeSessionIfOpen(
      id,
      {
        status: 'CLOSED',
        closedByUserId,
        closedAt: new Date(),
        closingAmount,
        expectedAmount,
        difference,
        notes: dto.notes ?? existing.notes,
      },
      tx,
    );

    if (result.count === 0) {
      throw new ConflictError('La sesion de caja ya se encuentra cerrada.');
    }

    const closed = await cashRepository.findSessionById(id, tx);

    if (!closed) {
      throw new NotFoundError('Sesion de caja');
    }

    return closed;
  }, transactionConfig.standard);

  return toCashSessionResponse(updated);
}

// ---------------------------------------------------------------------------
// CashMovement: movimientos de caja
// ---------------------------------------------------------------------------

export async function registerMovement(dto: CreateCashMovementDto): Promise<CashMovementResponse> {
  const sucursal = await cashRepository.findSucursalById(dto.sucursalId);

  if (!sucursal) {
    throw new NotFoundError('Sucursal');
  }

  const session = await cashRepository.findSessionById(dto.cashSessionId);

  if (!session) {
    throw new NotFoundError('Sesion de caja');
  }

  if (session.status !== 'OPEN') {
    throw new ConflictError('No se pueden registrar movimientos en una sesion de caja cerrada.');
  }

  const user = await cashRepository.findUserById(dto.userId);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  const created = await cashRepository.createMovement({
    sucursalId: dto.sucursalId,
    cashSessionId: dto.cashSessionId,
    userId: dto.userId,
    type: dto.type,
    amount: dto.amount,
    reason: dto.reason,
  });

  return toCashMovementResponse(created);
}

export async function findMovementById(id: string): Promise<CashMovementResponse> {
  const movement = await cashRepository.findMovementById(id);

  if (!movement) {
    throw new NotFoundError('Movimiento de caja');
  }

  return toCashMovementResponse(movement);
}

export async function findMovements(
  query: ListCashMovementsQuery,
): Promise<ListCashMovementsResult> {
  const [items, total] = await cashRepository.findMovements({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toCashMovementResponse(item)),
    total,
  };
}
