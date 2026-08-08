/**
 * modules/products/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de productos.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`products.controller.ts`, `products.service.ts`, etc.) directamente.
 */
export { productsRoutes } from './products.routes';

export {
  create as createProductController,
  findById as findByIdProductController,
  findMany as findManyProductsController,
  update as updateProductController,
  changeStatus as changeProductStatusController,
  remove as removeProductController,
} from './products.controller';

export {
  create as createProductService,
  findById as findByIdProductService,
  findMany as findManyProductsService,
  update as updateProductService,
  changeStatus as changeProductStatusService,
  remove as removeProductService,
} from './products.service';

export {
  CreateProductSchema,
  UpdateProductSchema,
  ListProductsQuerySchema,
  ChangeProductStatusSchema,
} from './products.validation';

export type {
  CreateProductDto,
  UpdateProductDto,
  ListProductsQueryDto,
  ChangeProductStatusDto,
} from './products.validation';

export type {
  UnitOfMeasure,
  ProductCategorySummary,
  ProductTaxSummary,
  ProductResponse,
  ListProductsFilters,
  ListProductsQuery,
  ListProductsResult,
  ProductResult,
} from './products.types';
