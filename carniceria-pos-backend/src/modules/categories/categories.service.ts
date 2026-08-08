/**
 * modules/categories/categories.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de categorias.
 *
 * Responsabilidades:
 *  - Validar existencia de la categoria antes de leer/actualizar/cambiar su
 *    estado.
 *  - Validar que `name` no este duplicado al crear o actualizar.
 *  - Traducir los registros de Prisma a la forma publica `CategoryResponse`
 *    (proyectando `parent` a `CategorySummary`).
 *
 * Toda consulta a la base de datos se hace a traves de
 * `categories.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import * as categoriesRepository from './categories.repository';
import type {
  CategoryLookupItem,
  CategoryResponse,
  ChangeCategoryStatusDto,
  CreateCategoryDto,
  ListCategoriesQuery,
  ListCategoriesResult,
  LookupCategoriesQuery,
  UpdateCategoryDto,
} from './categories.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type CategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  parentId: string | null;
  parent: { id: string; name: string; color: string | null } | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * QA.6 (Categorías): `name` es `@unique` a nivel de base de datos
 * (`schema.prisma`), pero ese indice NO excluye filas con `deletedAt`
 * distinto de `null` -- a diferencia de la validacion de arriba
 * (`findByName`), que si las excluye (via la extension de borrado
 * logico). Antes de esta correccion, reutilizar el nombre de una
 * categoria ya eliminada pasaba la validacion de la aplicacion (la
 * categoria borrada es invisible para `findFirst`) pero fallaba en la
 * base de datos con `P2002` sin traducir, cayendo en el 500 generico del
 * error handler. Mismo patron de traduccion ya usado en
 * `products/products.service.ts` (Bloque QA.1, mismo hallazgo exacto
 * sobre `sku`/`barcode`) y en `sales.service.ts`/`inventoryWaste/service.ts`
 * para otros campos `@unique` -- nunca se cambia el indice de la base de
 * datos, solo se traduce el error a uno legible.
 */
function translateUniqueConstraintError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('name')
  ) {
    throw new ConflictError(
      'El nombre de la categoria ya se encuentra registrado (puede pertenecer a una categoria eliminada).',
    );
  }

  throw error;
}

/**
 * QA.6 (Categorías): valida que asignar `candidateParentId` como padre de
 * `categoryId` no cree un ciclo (una categoría como su propio ancestro,
 * directo o transitivo) -- sin este chequeo, era posible asignar una
 * categoría como su propia categoría padre (verificado empíricamente:
 * `PATCH /categories/:id` con `parentId` igual al propio `id` respondía
 * `200`, sin error). El efecto real es en `CategoryTree.tsx` (frontend):
 * `buildForest()` empuja la categoría dentro de su propio arreglo
 * `children`, y expandir ese nodo entra en recursión infinita
 * (`TreeRow` se renderiza a sí mismo indefinidamente). Recorre la cadena
 * de padres desde `candidateParentId` hacia arriba; si `categoryId`
 * aparece en esa cadena, la asignación crearía un ciclo.
 */
async function assertNoParentCycle(categoryId: string, candidateParentId: string): Promise<void> {
  if (candidateParentId === categoryId) {
    throw new ValidationError('Una categoria no puede ser su propia categoria padre.');
  }

  let currentId: string | null = candidateParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === categoryId) {
      throw new ValidationError(
        'No se puede asignar esa categoria padre: crearia un ciclo en la jerarquia de categorias.',
      );
    }

    // Defensivo: corta la busqueda si un ciclo preexistente (no causado
    // por esta actualizacion) hiciera que este recorrido nunca llegue a
    // una raiz -- no deberia ocurrir si esta validacion siempre se aplico.
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const parent = await categoriesRepository.findById(currentId);
    currentId = parent?.parentId ?? null;
  }
}

/** Traduce un registro de Prisma a la forma publica de la categoria. */
function toCategoryResponse(category: CategoryRecord): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    color: category.color,
    parentId: category.parentId,
    parent: category.parent,
    active: category.active,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function create(dto: CreateCategoryDto): Promise<CategoryResponse> {
  const existingByName = await categoriesRepository.findByName(dto.name);

  if (existingByName) {
    throw new ConflictError('El nombre de la categoria ya se encuentra registrado.');
  }

  try {
    const created = await categoriesRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      color: dto.color ?? null,
      parentId: dto.parentId ?? null,
      active: dto.active ?? true,
    });

    return toCategoryResponse(created);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function findById(id: string): Promise<CategoryResponse> {
  const category = await categoriesRepository.findById(id);

  if (!category) {
    throw new NotFoundError('Categoria');
  }

  return toCategoryResponse(category);
}

export async function findMany(query: ListCategoriesQuery): Promise<ListCategoriesResult> {
  const [items, total] = await categoriesRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toCategoryResponse),
    total,
  };
}

/** Arquitectura de selectores, Bloque 1-2: patron de lookup — devuelve la
 * forma liviana `CategoryLookupItem[]`, nunca `CategoryResponse[]`.
 * Bloque 2: la forma se amplio de `LookupItem` generico a
 * `CategoryLookupItem` (ver justificacion en `categories.types.ts`) para
 * que `CategorySearchDialog.tsx` pueda migrar sin perder su fila de
 * resultado actual (categoria padre, descripcion). */
export async function lookup(query: LookupCategoriesQuery): Promise<CategoryLookupItem[]> {
  const items = await categoriesRepository.lookup({
    take: query.take,
    filters: query.filters,
  });

  return items.map((item) => ({
    id: item.id,
    label: item.name,
    parentName: item.parent?.name ?? null,
    description: item.description,
    color: item.color,
  }));
}

export async function update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
  const existing = await categoriesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Categoria');
  }

  if (dto.name && dto.name !== existing.name) {
    const existingByName = await categoriesRepository.findByName(dto.name);

    if (existingByName) {
      throw new ConflictError('El nombre de la categoria ya se encuentra registrado.');
    }
  }

  if (dto.parentId) {
    await assertNoParentCycle(id, dto.parentId);
  }

  try {
    const updated = await categoriesRepository.update(id, {
      name: dto.name,
      description: dto.description,
      color: dto.color,
      parentId: dto.parentId,
    });

    return toCategoryResponse(updated);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function changeStatus(
  id: string,
  dto: ChangeCategoryStatusDto,
): Promise<CategoryResponse> {
  const existing = await categoriesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Categoria');
  }

  const updated = await categoriesRepository.changeStatus(id, dto.active);

  return toCategoryResponse(updated);
}

/**
 * Borrado logico de una categoria. Idempotente por diseño: no distingue
 * "nunca existio" de "ya fue borrada" -- ambos casos devuelven
 * `NotFoundError`, porque `findById` ya pasa por el filtro global de
 * `deletedAt` (via la extension `softDelete.ext.ts`, con `Category` ya
 * registrado en `SOFT_DELETE_MODELS`). Mismo criterio que
 * `suppliers/service.ts::remove`.
 *
 * Antes de borrar, se bloquea si la categoria tiene productos o
 * subcategorias asociadas: el borrado logico no falla por restriccion de
 * llave foranea (sigue siendo un `update`, no un `delete` fisico), pero
 * dejaria esas filas apuntando a una categoria "eliminada" — una
 * inconsistencia de negocio, no de base de datos, que se previene aca
 * explicitamente con `ConflictError` (409).
 */
export async function remove(id: string): Promise<void> {
  const existing = await categoriesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Categoria');
  }

  const [productCount, childCount] = await Promise.all([
    categoriesRepository.countProducts(id),
    categoriesRepository.countChildren(id),
  ]);

  if (productCount > 0) {
    throw new ConflictError('No se puede eliminar la categoria porque tiene productos asociados.');
  }

  if (childCount > 0) {
    throw new ConflictError('No se puede eliminar la categoria porque tiene subcategorias asociadas.');
  }

  await categoriesRepository.softDelete(id);
}
