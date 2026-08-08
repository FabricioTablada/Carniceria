/**
 * modules/auth/auth.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de autenticacion.
 * Se monta bajo el prefijo `/auth` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * `/login` y `/refresh` NO requieren `authenticate`: son los puntos de
 * entrada para obtener u renovar un access token, no pueden depender de
 * tener uno vigente. `/logout` si lo requiere, porque necesita saber que
 * usuario esta cerrando sesion para el registro de auditoria (ver
 * `auth.service.ts`, funcion `logout()`).
 */
import { Router } from 'express';
import { authenticate, authRateLimiter } from '@/middlewares';
import { loginRateLimiter } from '@/middlewares/rateLimit.middleware';
import { login, logout, refresh, verifyPassword } from './auth.controller';

export const authRoutes = Router();

// `login` conserva ademas `loginRateLimiter` (mas estricto, apilado encima
// de `authRateLimiter`) — comportamiento sin cambios (Fase 19, Bloque 19.2).
authRoutes.post('/login', authRateLimiter, loginRateLimiter, login);
authRoutes.post('/refresh', authRateLimiter, refresh);
authRoutes.post('/logout', authRateLimiter, authenticate, logout);
// Bloque 7.24 (pantalla de bloqueo por inactividad): requiere `authenticate`
// a proposito — no es una superficie anonima como /login, por eso usa el
// cupo generoso de `authRateLimiter` y no `loginRateLimiter` (ver
// justificacion completa en `auth.service.ts::verifyPassword`).
authRoutes.post('/verify-password', authRateLimiter, authenticate, verifyPassword);