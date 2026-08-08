import type { ConfigurationValueType } from '../types/configuration.types'

/**
 * features/settings/constants/configuration.constants.ts
 * -----------------------------------------------------------------------------
 * `VALUE_TYPE_LABELS` vivía como una constante local de
 * `ConfigurationForm.tsx`. Bloque Configuración (rediseño, aprobado):
 * `ConfigurationsTable.tsx`/`ConfigurationFilters.tsx`/`ConfigurationDrawer.tsx`
 * necesitan el mismo mapa para no mostrar el valor crudo del backend
 * (`string`/`number`/`boolean`/`json`) sin traducir — se extrae a este
 * archivo (en vez de exportarla desde `ConfigurationForm.tsx`) porque ese
 * archivo exporta un componente y el linter (`react-refresh/only-export-
 * components`) no permite mezclar un export de componente con un export de
 * constante en el mismo archivo. Mismo criterio ya usado para
 * `PERMISSIONS_CATALOG_LIMIT` (`features/permissions/constants/`).
 */
export const VALUE_TYPE_LABELS: Record<ConfigurationValueType, string> = {
  string: 'Texto',
  number: 'Número',
  boolean: 'Booleano',
  json: 'JSON',
}
