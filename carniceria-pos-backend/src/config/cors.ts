/**
 * config/cors.ts
 * -----------------------------------------------------------------------------
 * Politica CORS de la aplicacion. Soporta una lista separada por comas en
 * CORS_ORIGIN (o "*" para permitir todos en desarrollo).
 */
import type { CorsOptions } from 'cors';
import { env, isDevelopment } from './env';

const configuredOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

const devFallbackOrigins = [
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
];

const allowedOrigins = isDevelopment
  ? Array.from(new Set([...configuredOrigins, ...devFallbackOrigins]))
  : configuredOrigins;

export const corsConfig: CorsOptions = {
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
