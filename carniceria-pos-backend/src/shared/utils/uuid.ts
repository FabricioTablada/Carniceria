/**
 * shared/utils/uuid.ts
 * -----------------------------------------------------------------------------
 * Generacion y validacion de UUID (decision #2: PK UUID para tablas
 * transaccionales y preparacion multi-sucursal).
 */
import { v4 as uuidv4, validate as isValidUuid } from 'uuid';

export function generateUuid(): string {
  return uuidv4();
}

export function isUuid(value: string): boolean {
  return isValidUuid(value);
}
