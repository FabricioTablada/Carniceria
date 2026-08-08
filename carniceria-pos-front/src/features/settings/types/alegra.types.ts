/**
 * features/settings/types/alegra.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del formulario de Configuración → Facturación Electrónica → Alegra
 * (Bloque 7.4). Refleja tal cual el contrato del backend
 * (`modules/integrations/alegra/alegra.types.ts`, Bloques 7.3/7.4) — este
 * frontend no reinterpreta esos campos.
 */

/** Credenciales que viajan en `POST /integrations/alegra/test-connection`
 * (Bloque 7.3, reutilizado tal cual). Nunca se persisten en el frontend. */
export interface AlegraTestConnectionDto {
  email: string
  token: string
  baseUrl?: string
}

/** Resultado de probar la conexión. */
export interface AlegraConnectionTestResult {
  connected: true
  company: {
    name: string | null
    identification: string | null
  }
}

/** Cuerpo de `POST /integrations/alegra/config` (Bloque 7.4). `token`
 * opcional: vacío significa "conservar el token ya guardado" — el
 * formulario nunca reenvía el token real tras la carga inicial. */
export interface SaveAlegraConfigDto {
  email: string
  token?: string
  baseUrl: string
}

/** Respuesta de `GET /integrations/alegra/config` — solo lo ya guardado
 * localmente, sin disparar ninguna llamada a Alegra. */
export interface AlegraConfigStatus {
  configured: boolean
  email: string | null
  baseUrl: string | null
  maskedToken: string | null
  updatedAt: string | null
}
