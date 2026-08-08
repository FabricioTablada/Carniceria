/**
 * types/lookup.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 3: forma generica del patron de lookup
 * para entidades cuyo selector solo necesita mostrar un nombre (Proveedores,
 * Impuestos) — coincide exactamente con `LookupItem` del backend
 * (`shared/utils/lookup.ts`). Productos y Categorias NO usan este tipo:
 * tienen su propio DTO especifico (`ProductLookupItem`/`CategoryLookupItem`)
 * porque sus filas de resultado muestran mas que un nombre (Bloque 2).
 *
 * Unica fuente de este shape en el frontend — evita que cada modulo
 * redeclare su propio `{id,label}` por separado.
 */
export interface LookupItem {
  id: string
  label: string
}

/** Respuesta real de cualquier `GET /<recurso>/lookup` que use el DTO
 * generico — sin `meta` de paginacion (el lookup no la tiene). */
export interface LookupResponse {
  success: true
  data: LookupItem[]
}
