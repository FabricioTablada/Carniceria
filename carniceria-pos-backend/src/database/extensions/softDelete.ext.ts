/**
 * database/extensions/softDelete.ext.ts
 * -----------------------------------------------------------------------------
 * Extension de Prisma que implementa el filtrado de BORRADO LOGICO (soft
 * delete) de forma global (decision #2).
 *
 * Enfoque (importante):
 *  - LECTURAS: findMany / findFirst / count / aggregate excluyen
 *    automaticamente los registros con `deletedAt != null`.
 *  - ESCRITURA del borrado: se realiza a nivel de REPOSITORIO como un
 *    `update({ data: { deletedAt: new Date() } })`. No se intercepta `delete`
 *    para convertirlo en update, porque una extension de tipo `query` no puede
 *    cambiar la operacion real que ejecuta Prisma (seguiria siendo un borrado
 *    fisico). Mantener el borrado logico explicito en el repositorio es la
 *    practica correcta y evita comportamientos ocultos.
 *
 * SOLO aplica a los modelos registrados en SOFT_DELETE_MODELS. A medida que
 * cada modulo agregue su modelo con la columna `deletedAt`, se anade aqui su
 * nombre. Vacio en la infraestructura base.
 */
import { Prisma } from '@prisma/client';

export const SOFT_DELETE_MODELS = new Set<string>([
  'Supplier',
  'Category',
  'Tax',
  'Promotion',
  'Product',
  'Customer',
]);

function usesSoftDelete(model?: string): boolean {
  return !!model && SOFT_DELETE_MODELS.has(model);
}

type ArgsWithWhere = { where?: Record<string, unknown> };

function applyNotDeletedFilter(args: unknown): void {
  const typed = args as ArgsWithWhere;
  typed.where = { ...(typed.where ?? {}), deletedAt: null };
}

export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    $allModels: {
      async findFirst({ model, args, query }) {
        if (usesSoftDelete(model)) applyNotDeletedFilter(args);
        return query(args);
      },
      async findMany({ model, args, query }) {
        if (usesSoftDelete(model)) applyNotDeletedFilter(args);
        return query(args);
      },
      async count({ model, args, query }) {
        if (usesSoftDelete(model)) applyNotDeletedFilter(args);
        return query(args);
      },
      async aggregate({ model, args, query }) {
        if (usesSoftDelete(model)) applyNotDeletedFilter(args);
        return query(args);
      },
    },
  },
});
