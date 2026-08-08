/**
 * database/extensions/syncStatus.ext.ts
 * -----------------------------------------------------------------------------
 * Extension que marca `sync_status = PENDING` en cada create/update de los
 * modelos sincronizables (decision #2: preparacion para la nube - Fase 2).
 *
 * A diferencia del borrado logico, aqui SI es seguro mutar `args.data`: la
 * operacion (create/update) no cambia, solo se enriquecen los datos.
 *
 * SOLO aplica a los modelos registrados en SYNCABLE_MODELS. Vacio en la
 * infraestructura base.
 */
import { Prisma } from '@prisma/client';

export const SYNCABLE_MODELS = new Set<string>([
  // 'Sale', 'Purchase', 'InventoryMovement', ...
]);

function isSyncable(model?: string): boolean {
  return !!model && SYNCABLE_MODELS.has(model);
}

type ArgsWithData = { data?: Record<string, unknown> };

function markPending(args: unknown): void {
  const typed = args as ArgsWithData;
  typed.data = { ...(typed.data ?? {}), syncStatus: 'PENDING' };
}

export const syncStatusExtension = Prisma.defineExtension({
  name: 'sync-status',
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (isSyncable(model)) markPending(args);
        return query(args);
      },
      async update({ model, args, query }) {
        if (isSyncable(model)) markPending(args);
        return query(args);
      },
    },
  },
});
