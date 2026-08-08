/**
 * modules/integrations/alegra/alegra.client.ts
 * -----------------------------------------------------------------------------
 * Unico punto de comunicacion HTTP con la API de Alegra. Ningun otro
 * archivo de este modulo, ni de ningun modulo futuro que emita facturas o
 * sincronice clientes/productos/impuestos (Bloque 7.4+), debe instanciar
 * axios directo contra `api.alegra.com` — todo pasa por
 * `createAlegraClient()`. Este es tambien el unico lugar que interpreta un
 * `AxiosError` (`toAppError`), para que ningun otro archivo repita esa
 * logica de traduccion.
 *
 * Excepcion deliberada (Bloque 8.5): descargar el archivo PDF/XML de una
 * factura (`downloadInvoiceFile`, `alegra.service.ts`) NO es una llamada a
 * `api.alegra.com` — es una URL de archivo ya resuelta que Alegra devuelve
 * en su respuesta (para el XML, tipicamente una URL PREFIRMADA de S3, con
 * su propia autenticacion en la query string). Esa descarga usa axios
 * directo, sin las credenciales de Alegra — reutilizar `client` (con Basic
 * Auth) contra esa URL rompe la firma de S3 (`400`, "Only one auth
 * mechanism allowed", bug real encontrado y corregido en el Bloque 8.5).
 * La regla de arriba sigue aplicando sin excepcion para cualquier llamada
 * real a la API de Alegra.
 *
 * Bloque 7.3: solo construye el cliente HTTP (Basic Auth, timeout, base
 * URL) y normaliza errores de red/autenticacion a la jerarquia de errores
 * del backend (`shared/errors`). No implementa ninguna operacion de
 * negocio — eso es responsabilidad de `alegra.service.ts` y de los modulos
 * de mapeo que se agreguen mas adelante (ver Bloque 7.2, punto 5).
 */
import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { ExternalServiceError, UnauthorizedError } from '@/shared/errors';
import type { AlegraCredentials } from './alegra.types';

/** URL base oficial de la API de Alegra, confirmada en el Bloque 7.2 contra
 * `developer.alegra.com/reference/post_invoices` y
 * `developer.alegra.com/reference/get_company-1`. */
export const ALEGRA_DEFAULT_BASE_URL = 'https://api.alegra.com/api/v1';

/** Nombre del contacto generico requerido para emitir facturas sin un
 * cliente real identificado (Bloque 7.5, mismo criterio que "Publico
 * general" ya usa el POS del frontend). Constante unica: tanto la
 * busqueda como la creacion en `alegra.service.ts` (`resolveGenericClient`)
 * usan este mismo valor — nunca un literal repetido. */
export const ALEGRA_GENERIC_CLIENT_NAME = 'Cliente General';

/** Timeout conservador para una integracion externa administrada por un
 * tercero: evita que una respuesta lenta de Alegra bloquee indefinidamente
 * un request del ERP (ver validacion de "timeout" del Bloque 7.3). */
const ALEGRA_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Construye una instancia de Axios configurada para hablar con Alegra
 * (Basic Auth con correo + token, timeout, base URL). Las credenciales
 * llegan por parametro en cada llamada — este bloque NO las persiste (ver
 * "No implementar" del Bloque 7.3); de donde vienen en el futuro
 * (configuracion guardada por el usuario) es una decision de un bloque
 * posterior que no requiere cambiar este cliente.
 */
export function createAlegraClient(credentials: AlegraCredentials): AxiosInstance {
  return axios.create({
    baseURL: credentials.baseUrl ?? ALEGRA_DEFAULT_BASE_URL,
    timeout: ALEGRA_REQUEST_TIMEOUT_MS,
    auth: {
      username: credentials.email,
      password: credentials.token,
    },
    headers: {
      Accept: 'application/json',
    },
  });
}

/**
 * Normaliza cualquier error de una llamada a Alegra (credenciales
 * invalidas, red caida, timeout, error del lado de Alegra) a la jerarquia
 * de errores del backend, para que `middlewares/errorHandler.middleware.ts`
 * lo traduzca igual que cualquier otro error de dominio — sin que cada
 * operacion futura tenga que repetir esta interpretacion.
 */
export function toAppError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error('Error desconocido al conectar con Alegra.');
  }

  const axiosError = error as AxiosError;

  if (axiosError.code === 'ECONNABORTED') {
    return new ExternalServiceError('Alegra no respondio a tiempo (timeout).', {
      code: axiosError.code,
    });
  }

  if (!axiosError.response) {
    return new ExternalServiceError('No se pudo establecer conexion con Alegra.', {
      code: axiosError.code,
    });
  }

  if (axiosError.response.status === 401 || axiosError.response.status === 403) {
    return new UnauthorizedError('Las credenciales de Alegra son invalidas.', {
      status: axiosError.response.status,
      body: axiosError.response.data,
    });
  }

  return new ExternalServiceError('Alegra respondio con un error.', {
    status: axiosError.response.status,
    body: axiosError.response.data,
  });
}
