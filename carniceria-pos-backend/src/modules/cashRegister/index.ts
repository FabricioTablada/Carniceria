/**
 * modules/cashRegister/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de cajas registradoras.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`cashRegister.controller.ts`, `cashRegister.service.ts`, etc.)
 * directamente.
 */
export { cashRegisterRoutes } from './cashRegister.routes';
export {
  create as createCashRegisterController,
  findById as findByIdCashRegisterController,
  findMany as findManyCashRegistersController,
  update as updateCashRegisterController,
  changeStatus as changeCashRegisterStatusController,
} from './cashRegister.controller';
export {
  create as createCashRegisterService,
  findById as findByIdCashRegisterService,
  findMany as findManyCashRegistersService,
  update as updateCashRegisterService,
  changeStatus as changeCashRegisterStatusService,
} from './cashRegister.service';
export {
  CreateCashRegisterSchema,
  UpdateCashRegisterSchema,
  ListCashRegistersQuerySchema,
  ChangeCashRegisterStatusSchema,
} from './cashRegister.validation';
export type {
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
  ListCashRegistersQueryDto,
  ChangeCashRegisterStatusDto,
} from './cashRegister.validation';
export type {
  CashRegisterSucursalSummary,
  CashRegisterResponse,
  ListCashRegistersFilters,
  ListCashRegistersQuery,
  ListCashRegistersResult,
  CashRegisterResult,
} from './cashRegister.types';
