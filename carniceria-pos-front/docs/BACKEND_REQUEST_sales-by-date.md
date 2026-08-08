# Backend request: `GET /reports/sales-by-date`

**Estado: ✅ resuelto — implementado y consumido.** Verificado en el código real (2026-08-02): el endpoint existe (`SalesByDateFilters`/`SalesByDateItem` en `src/features/reports/types/report.types.ts`, `reportsApi.getSalesByDate`) y el frontend ya lo consume (`useSalesByDate.ts`, `SalesByDateLineChart.tsx`, integrado en `DashboardPage.tsx` — el panel "Ventas últimos 7 días" ya no muestra el estado "Próximamente" descrito más abajo). Este documento se conserva como registro histórico de la especificación original; no requiere ninguna acción adicional.

---

Estado original de este documento (histórico, ya no vigente — ver arriba): **pendiente** (no implementado en el backend todavía). Este documento existía para que, cuando se agendara ese bloque de trabajo, el backend tuviera la especificación exacta que necesitaba el frontend — no requería volver a investigar nada.

## Por qué se necesita

El Dashboard (`src/pages/DashboardPage.tsx`) quiere mostrar un gráfico de líneas "Ventas últimos 7 días" (monto vendido por día + cantidad de ventas por día). Se investigó el módulo `reports` completo (`src/features/reports/`) y **no existe ningún endpoint que agrupe ventas por fecha**:

- `GET /reports/dashboard` — agregados de todo el rango, sin desglose por día.
- `GET /reports/sales-by-category` / `GET /reports/sales-by-cashier` — agrupan por categoría/cajero, no por fecha.
- `GET /reports/sales` — filas de venta individuales (`SalesReportItem[]`), paginadas. Tiene `dateFrom`/`dateTo`, pero **no es seguro** armar el gráfico agrupando esto en el cliente: el tipo `SalesReportFilters` del frontend no expone `page`/`limit`, así que no hay forma de garantizar traer *todas* las ventas de los últimos 7 días — si una sucursal hace más ventas que el tamaño de página por defecto del backend, el gráfico mostraría totales truncados sin que se note. Se decidió explícitamente no construir el gráfico sobre esta base.

Mientras este endpoint no exista, el panel "Ventas últimos 7 días" del Dashboard se deja como un estado "Próximamente" (mismo `Card` del Design System, sin datos inventados).

## Endpoint recomendado

```
GET /reports/sales-by-date
```

Mismo prefijo y convención que el resto del módulo `reports` (`/reports/sales-by-category`, `/reports/sales-by-cashier`, etc.).

### Query params (filtros)

Mismo criterio que `SalesByCategoryFilters`/`SalesByCashierFilters` (sin `categoryId`/`userId` porque no aplican a este agrupamiento):

```ts
interface SalesByDateFilters {
  sucursalId?: string
  dateFrom?: string // ISO date (YYYY-MM-DD). Si se omite, default: hoy - 6 días.
  dateTo?: string   // ISO date (YYYY-MM-DD). Si se omite, default: hoy.
}
```

- Si no se envían `dateFrom`/`dateTo`, el backend debe asumir **los últimos 7 días calendario** (incluyendo hoy) — es el caso de uso real del Dashboard.
- Se aceptan `dateFrom`/`dateTo` explícitos para permitir reutilizar el mismo endpoint desde otras pantallas de reportes en el futuro (no solo el Dashboard), sin necesidad de otro endpoint.
- El backend debe devolver **un registro por cada día del rango solicitado, sin huecos** — si un día no tuvo ventas, igual debe aparecer con `salesCount: 0` y `totalAmount: 0`. Esto es requisito del frontend: el gráfico de líneas necesita continuidad diaria (ver más abajo), y no debe ser el frontend quien "rellene" los días faltantes adivinando fechas.

## DTO recomendado (NestJS, mismo patrón que los DTOs de filtros ya existentes en `reports`)

```ts
// sales-by-date.filters.dto.ts
import { IsDateString, IsOptional, IsUUID } from 'class-validator'

export class SalesByDateFiltersDto {
  @IsOptional()
  @IsUUID()
  sucursalId?: string

  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @IsOptional()
  @IsDateString()
  dateTo?: string
}
```

## Respuesta recomendada

Mismo envelope que el resto de los reportes "lista sin paginación" (`sales-by-category`, `sales-by-cashier`, `low-stock`, `top-products` — ver `ApiEnvelope<T>` en `src/features/reports/api/reports.api.ts`):

```ts
interface SalesByDateItem {
  date: string        // ISO date, YYYY-MM-DD (sin hora/timezone)
  salesCount: number  // cantidad de VENTAS distintas ese día (no lineas de detalle)
  totalAmount: number // suma de Sale.total ese día
}

interface SalesByDateResponse {
  success: true
  data: SalesByDateItem[] // siempre uno por dia del rango, sin huecos, ordenado ascendente por fecha
}
```

### Ejemplo de respuesta (7 días, uno sin ventas)

```json
{
  "success": true,
  "data": [
    { "date": "2026-07-19", "salesCount": 18, "totalAmount": 245000 },
    { "date": "2026-07-20", "salesCount": 22, "totalAmount": 318000 },
    { "date": "2026-07-21", "salesCount": 0,  "totalAmount": 0 },
    { "date": "2026-07-22", "salesCount": 15, "totalAmount": 198500 },
    { "date": "2026-07-23", "salesCount": 20, "totalAmount": 276000 },
    { "date": "2026-07-24", "salesCount": 25, "totalAmount": 341200 },
    { "date": "2026-07-25", "salesCount": 9,  "totalAmount": 121000 }
  ]
}
```

- `salesCount` cuenta ventas distintas (agrupa sobre `Sale`, igual criterio que `SalesByCashierItem.totalSales` — no lineas de detalle como en `SalesByCategoryItem.salesCount`/`TopProductItem.salesCount`, que sí cuentan lineas).
- `totalAmount` es la suma de `Sale.total` (ya con impuestos/descuentos aplicados, mismo campo que usa el resto de `reports`), no `subtotal`.
- Ventas anuladas (`status` distinto del estado válido — ver el mismo filtro de `status` que ya aplican `sales-by-category`/`sales-by-cashier` internamente) deben excluirse, mismo criterio que el resto de los reportes de ventas.
- Registros con `deletedAt` no nulo (soft-delete) también deben excluirse, mismo criterio que el resto del módulo.

## Índices de base de datos recomendados

La consulta filtra por `sucursalId` (opcional) + rango de `saleDate`, y agrupa por el día de `saleDate`. Se recomienda:

1. **Índice compuesto `(sucursalId, saleDate)`** sobre `Sale` — cubre tanto el filtro por sucursal como el rango de fechas en un único índice, y es reutilizable por `sales-by-category`/`sales-by-cashier`/`sales` si no existe ya alguno equivalente (verificar antes de crear uno duplicado).
2. Si `sucursalId` no se envía (consulta multi-sucursal), un **índice simple en `saleDate`** sigue siendo útil para el rango de 7 días.
3. Si el modelo `Sale` tiene `deletedAt` (soft-delete) y se filtra siempre por `deletedAt IS NULL`, evaluar un **índice parcial/filtrado** (`WHERE deletedAt IS NULL`) si el motor de base de datos lo soporta (Postgres sí) — reduce el tamaño del índice y acelera el filtro que se aplica en el 100% de las consultas de reportes.

(Confirmar contra el `schema.prisma` real del backend — este frontend no tiene acceso a ese archivo — si alguno de estos índices ya existe antes de crear uno nuevo.)

## ¿SQL crudo o Prisma "normal"?

**Recomendado: SQL crudo vía `$queryRaw` (o `$queryRawUnsafe` con params tipados) de Prisma**, no un `findMany` + agrupación en JS. Razones:

1. **Agrupar por día** requiere truncar el timestamp (`DATE(saleDate)` en Postgres/MySQL) dentro del `GROUP BY` — Prisma Client no tiene una API nativa para "group by date-part de un campo", solo `groupBy` sobre columnas completas. Sin SQL crudo, habría que traer todas las filas del rango a la aplicación y agruparlas en memoria — funciona, pero es exactamente el mismo patrón (traer filas crudas) que ya se descartó para el frontend por el riesgo de paginación/truncamiento; en el backend no hay paginación, así que es viable, pero es menos eficiente que agrupar en la base de datos.
2. **Rellenar los días sin ventas** (requisito explícito de este documento: "sin huecos") se resuelve limpio en SQL con una serie de fechas generada (`generate_series` en Postgres) y un `LEFT JOIN` contra las ventas agregadas — mucho más simple que generar los 7 días en JS y hacer un merge manual contra el resultado de Prisma.
3. Mismo criterio que ya usa el propio backend: el hallazgo documentado en `report.types.ts` (`SalesReportItem`, etc.) indica que los reportes actuales ya se arman con includes/agregaciones ad-hoc en `reports.repository.ts` — agregar una consulta SQL cruda ahí es consistente con el patrón existente, no un enfoque nuevo.

Ejemplo ilustrativo (Postgres, ajustar nombres reales de columnas/tabla contra `schema.prisma`):

```sql
SELECT
  d.day::date AS date,
  COALESCE(COUNT(s.id), 0)::int AS "salesCount",
  COALESCE(SUM(s.total), 0)::float AS "totalAmount"
FROM generate_series(
  $1::date, -- dateFrom
  $2::date, -- dateTo
  interval '1 day'
) AS d(day)
LEFT JOIN "Sale" s
  ON DATE(s."saleDate") = d.day
  AND s."deletedAt" IS NULL
  AND ($3::uuid IS NULL OR s."sucursalId" = $3)
GROUP BY d.day
ORDER BY d.day ASC;
```

Ejecutar vía `this.prisma.$queryRaw` (o `$queryRawUnsafe` con los params ya validados por `SalesByDateFiltersDto`), tipando el resultado manualmente igual que el resto de `reports.repository.ts` hace con los demás reportes ad-hoc.

## Resumen para cuando se implemente

- [ ] `SalesByDateFiltersDto` (`sucursalId?`, `dateFrom?`, `dateTo?`), default de rango = últimos 7 días si se omiten.
- [ ] `GET /reports/sales-by-date` → `{ success: true, data: SalesByDateItem[] }`, un item por día, sin huecos, orden ascendente.
- [ ] Consulta con SQL crudo (`generate_series` + `LEFT JOIN`) para garantizar continuidad diaria sin lógica de relleno en el cliente.
- [ ] Verificar/crear índice `(sucursalId, saleDate)` sobre `Sale` (y evaluar índice parcial por `deletedAt IS NULL`).
- [ ] Excluir ventas con `deletedAt` no nulo y con `status` anulado/cancelado, mismo criterio que `sales-by-category`/`sales-by-cashier`.

Una vez exista este endpoint, el frontend agrega `SalesByDateFilters`/`SalesByDateItem`/`PaginatedSalesByDateResponse` (o el nombre que corresponda) a `src/features/reports/types/report.types.ts`, un método `getSalesByDate` en `reports.api.ts`, un hook `useSalesByDate` (mismo patrón que `useSalesByCategory`), y reemplaza el estado "Próximamente" del panel derecho del Dashboard por el gráfico de líneas real.