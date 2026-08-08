/**
 * database/extensions/timestamps.ext.ts
 * -----------------------------------------------------------------------------
 * Estrategia de timestamps (decision #2: created_at / updated_at).
 *
 * En este proyecto los timestamps se garantizan a NIVEL DE ESQUEMA en Prisma:
 *   created_at DateTime @default(now())  @map("created_at")
 *   updated_at DateTime @updatedAt        @map("updated_at")
 *
 * Por eso no se necesita logica adicional en tiempo de ejecucion. Este modulo
 * documenta la convencion de forma explicita y deja el punto de extension listo
 * por si en el futuro se requiere logica de timestamps mas alla del esquema.
 */
import { Prisma } from '@prisma/client';

export const timestampsExtension = Prisma.defineExtension({
  name: 'timestamps',
  // Sin overrides: los timestamps los maneja el esquema (@default(now()) / @updatedAt).
});
