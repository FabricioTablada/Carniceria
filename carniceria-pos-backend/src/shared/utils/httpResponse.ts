/**
 * shared/utils/httpResponse.ts
 * -----------------------------------------------------------------------------
 * Formato ESTANDAR de respuesta de la API. Todas las respuestas (exito o error)
 * comparten una envoltura consistente para simplificar el consumo desde el
 * cliente POS.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function success<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  if (data === undefined) {
    // JSON.stringify() elimina en silencio las claves con valor `undefined`,
    // por lo que un `data` indefinido produciría un 200 con { success: true }
    // vacío, sin ningún indicio del error real. Preferimos fallar fuerte y
    // explícito para que el bug se detecte en el momento en que ocurre,
    // no en el cliente.
    throw new Error(
      'success() fue llamado con data=undefined. Revisa que el service ' +
        'que invoca a este controller esté retornando el valor esperado.',
    );
  }

  return meta ? { success: true, data, meta } : { success: true, data };
}

export function failure(code: string, message: string, details?: unknown): ApiError {
  return { success: false, error: { code, message, details } };
}
