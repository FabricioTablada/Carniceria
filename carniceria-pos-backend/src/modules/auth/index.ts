/**
 * modules/auth/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de autenticacion.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`auth.controller.ts`, `auth.service.ts`, etc.) directamente.
 */
export { authRoutes } from './auth.routes';
export { login as loginController } from './auth.controller';
export { login as loginService } from './auth.service';
export { LoginSchema } from './auth.validation';
export type { LoginDto } from './auth.validation';
