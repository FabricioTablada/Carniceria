/**
 * modules/taxes/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de impuestos.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`taxes.controller.ts`, `taxes.service.ts`, etc.) directamente.
 */
export { taxesRoutes } from './taxes.routes';
export {
  create as createTaxController,
  findById as findByIdTaxController,
  findMany as findManyTaxesController,
  update as updateTaxController,
  changeStatus as changeTaxStatusController,
  remove as removeTaxController,
} from './taxes.controller';
export {
  create as createTaxService,
  findById as findByIdTaxService,
  findMany as findManyTaxesService,
  update as updateTaxService,
  changeStatus as changeTaxStatusService,
  remove as removeTaxService,
} from './taxes.service';
export {
  CreateTaxSchema,
  UpdateTaxSchema,
  ListTaxesQuerySchema,
  ChangeTaxStatusSchema,
} from './taxes.validation';
export type {
  CreateTaxDto,
  UpdateTaxDto,
  ListTaxesQueryDto,
  ChangeTaxStatusDto,
} from './taxes.validation';
export type {
  TaxResponse,
  ListTaxesFilters,
  ListTaxesQuery,
  ListTaxesResult,
  TaxResult,
} from './taxes.types';
