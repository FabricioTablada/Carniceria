/**
 * modules/users/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de usuarios.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`users.controller.ts`, `users.service.ts`, etc.) directamente.
 */
export { usersRoutes } from './users.routes';
export {
  create as createUserController,
  findById as findByIdUserController,
  findMany as findManyUsersController,
  update as updateUserController,
  changeStatus as changeUserStatusController,
} from './users.controller';
export {
  create as createUserService,
  findById as findByIdUserService,
  findMany as findManyUsersService,
  update as updateUserService,
  changeStatus as changeUserStatusService,
} from './users.service';
export {
  CreateUserSchema,
  UpdateUserSchema,
  ListUsersQuerySchema,
  ChangeUserStatusSchema,
} from './users.validation';
export type {
  CreateUserDto,
  UpdateUserDto,
  ListUsersQueryDto,
  ChangeUserStatusDto,
} from './users.validation';
