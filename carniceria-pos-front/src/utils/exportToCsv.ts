export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number
}

/**
 * utils/exportToCsv.ts
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 3: exportacion 100% del lado del cliente —
 * arma un CSV a partir de filas YA CARGADAS en pantalla (`rows`), sin pedir
 * nada nuevo al backend. Por eso exporta exactamente lo que el usuario esta
 * viendo (la pagina actual del listado, ya paginado), nunca "todo el
 * catalogo" — pedir todo el catalogo requeriria una peticion nueva fuera
 * del alcance de este bloque (arquitectura de listados/paginacion sin
 * tocar).
 *
 * Sin dependencia nueva: construye el CSV como texto plano (comillas
 * dobles + escape de comillas internas, formato estandar) y dispara la
 * descarga con un `<a>` temporal — mismo patron que cualquier descarga de
 * archivo generada en el navegador, sin libreria externa.
 */
function escapeCsvValue(value: string | number): string {
  const stringValue = String(value)

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

export function exportToCsv<T>(rows: T[], columns: CsvColumn<T>[], filename: string): void {
  const headerLine = columns.map((column) => escapeCsvValue(column.header)).join(',')
  const dataLines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(','),
  )
  const csvContent = [headerLine, ...dataLines].join('\n')

  // BOM UTF-8: sin esto, Excel (el consumidor mas probable de este CSV en
  // el contexto de PIPASA) interpreta mal los acentos/ñ del contenido.
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
