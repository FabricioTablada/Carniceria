/**
 * config/jwt.ts
 * -----------------------------------------------------------------------------
 * Configuracion central de firma y expiracion de tokens JWT.
 * El modulo de autenticacion consumira estos valores; nunca deben leerse
 * secretos de JWT fuera de este punto.
 */
import { env } from './env';

export const jwtConfig = {
  access: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  refresh: {
    secret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
} as const;
