/**
 * modules/processing/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de Despiece.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`repository.ts`, `service.ts`, etc.) directamente.
 */
export { processingRoutes } from './routes';
export {
  create as createProcessingOperationService,
  findById as findByIdProcessingOperationService,
  findMany as findManyProcessingOperationsService,
  update as updateProcessingOperationService,
  cancel as cancelProcessingOperationService,
  addOutputItem as addProcessingOutputItemService,
  updateOutputItem as updateProcessingOutputItemService,
  removeOutputItem as removeProcessingOutputItemService,
  addWasteLine as addProcessingWasteLineService,
  updateWasteLine as updateProcessingWasteLineService,
  removeWasteLine as removeProcessingWasteLineService,
  complete as completeProcessingOperationService,
} from './service';
export type {
  ProcessingOperationResponse,
  ProcessingOutputItemResponse,
  ProcessingWasteItemResponse,
  CreateProcessingOperationDto,
  UpdateProcessingOperationDto,
  AddProcessingOutputItemDto,
  UpdateProcessingOutputItemDto,
  AddProcessingWasteItemDto,
  UpdateProcessingWasteItemDto,
  ListProcessingOperationsQuery,
  ListProcessingOperationsResult,
} from './types';
