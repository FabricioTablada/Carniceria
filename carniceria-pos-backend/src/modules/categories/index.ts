/**
 * modules/categories/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de categorias.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`categories.controller.ts`, `categories.service.ts`, etc.) directamente.
 */
export { categoriesRoutes } from './categories.routes';
export {
  create as createCategoryController,
  findById as findByIdCategoryController,
  findMany as findManyCategoriesController,
  update as updateCategoryController,
  changeStatus as changeCategoryStatusController,
  remove as removeCategoryController,
} from './categories.controller';
export {
  create as createCategoryService,
  findById as findByIdCategoryService,
  findMany as findManyCategoriesService,
  update as updateCategoryService,
  changeStatus as changeCategoryStatusService,
  remove as removeCategoryService,
} from './categories.service';
export {
  CreateCategorySchema,
  UpdateCategorySchema,
  ListCategoriesQuerySchema,
  ChangeCategoryStatusSchema,
} from './categories.validation';
export type {
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesQueryDto,
  ChangeCategoryStatusDto,
} from './categories.validation';
export type {
  CategorySummary,
  CategoryResponse,
  ListCategoriesFilters,
  ListCategoriesQuery,
  ListCategoriesResult,
  CategoryResult,
} from './categories.types';
