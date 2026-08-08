# Sistema de Diseño — Carnicería POS (Frontend)

Versión 1.0 — basada en auditoría directa del código real en `carniceria-pos-front/src`.

> **Nota de actualización (2026-08-02):** el rediseño UX/UI integral del ERP (todos los módulos, incluido el POS) quedó cerrado en esta fecha — ver `ROADMAP.md`. Este documento **sigue sin reescribirse por completo** (prioridad más baja, ver `CLAUDE.md`) y varios conteos/inventarios de abajo siguen desactualizados — `components/ui/` ya tiene bastantes más de 9 archivos (incluye `Dialog.tsx`, `Pagination.tsx`, `Popover.tsx`, `RowMenu.tsx`, `WorkspacePanel.tsx`, `MediaCard.tsx`, `PillGroup.tsx`, `SegmentedControl.tsx`, `Tabs.tsx`, `SearchInput.tsx`, `SearchPickerPanel.tsx`, `switch.tsx`, entre otros), `Badge.tsx`/`Skeleton.tsx`/`EmptyState.tsx` viven en `components/common/`, y módulos como `features/sales/components/` suman componentes propios nuevos no listados acá (`NumericKeypad.tsx`, `PromotionCard.tsx`, `useFavoriteProducts.ts`). El POS (`features/sales/`) además tiene su **propia** familia de tokens, `.pos-surface` (`--pos-bg`/`--pos-panel`/`--pos-panel-2`/`--pos-border`/`--pos-ink`/`--pos-ink-muted`, definida en `src/index.css`), separada de `--pos-content`/`--pos-content-muted` de abajo — ver `CLAUDE.md` ("POS-specific decisions") para el detalle completo y actualizado, incluida la nota sobre por qué esos tokens no resuelven dentro de diálogos renderizados en un Portal. Para el estado real y vigente de componentes/tokens, `CLAUDE.md` es la fuente de verdad; este documento sigue siendo útil para el resto del historial de auditoría (Etapas 1 a 5.7 y las secciones 9-11) que no cambió.

## 0. Método y alcance

Este documento **no** se basa en `FRONTEND_ARCHITECTURE.md` ni en ningún resumen previo de la conversación. Se basa exclusivamente en lo que existe hoy en el repositorio (17 módulos en `src/features`, `src/components`, `src/layouts`, `src/lib`, `src/utils`). Donde el código contradice la documentación anterior, se documenta el código y se señala la discrepancia explícitamente, para que la decisión de qué hacer quede en manos del equipo, no del documento.

No se propone ninguna tecnología nueva. No se renombra nada existente. Este documento solo describe, organiza y da nombre a patrones que ya están en uso (o marca su ausencia).

---

## 1. Stack confirmado en código

- React 19 + TypeScript + Vite (rolldown-vite), React Router
- TanStack Query para estado remoto
- Axios (`lib/htpp/client.ts` — nombre real del archivo, con "htpp", no "http")
- React Hook Form + Zod por módulo (`schemas/`)
- Tailwind CSS v4 (`@theme inline` en `index.css`, sin `tailwind.config.js` — la config vive en CSS)
- shadcn/ui, estilo **`base-nova`**, color base **neutral**, primitivos de **`@base-ui/react`** (no Radix)
- Zustand para estado de auth y de sesión de caja
- Lucide para iconos
- Redux Toolkit y `react-redux` están instalados (`@reduxjs/toolkit`, `redux-thunk`) pero **no se encontró uso real** en `src/features` ni `src/stores` — antes de usarlos habría que confirmar si es deuda de dependencias o si hay un slice en camino.

## 2. Tokens de diseño (fuente: `src/index.css`)

**Actualización posterior a la versión 1.0 — Etapa 5.4 cerrada**: ya existen tokens de marca reales, agregados en `:root` y `.dark`:

- `--brand` / `--brand-foreground` — acento de marca (terracota).
- `--accent-amber` / `--accent-amber-foreground`.
- `--accent-teal` / `--accent-teal-foreground`.

La familia `--sidebar-*` (que en la v1.0 de este documento estaba definida pero sin uso) **ya está en uso real**, reasignada a una paleta oscura cálida — consumida por `Sidebar.tsx` (`components/common/`), reutilizado tanto por `DashboardLayout` como por `PosLayout`. El sidebar **es oscuro en la práctica**, no solo en la documentación.

Tokens base de shadcn sin cambios: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `radius` (`0.625rem`).

**Nuevo uso real de token, Etapa 5.7**: `--chart-1` (existía desde el inicio del proyecto, sin ningún consumidor) ahora se usa en `SalesByCategoryChart.tsx` como color de barra del gráfico — primer uso real de la escala `chart-*` en todo el proyecto.

Tipografía: **Geist Variable** (`@fontsource-variable/geist`), sin cambios.

Radios y sombras: sin cambios respecto a la v1.0 (`rounded-lg` en inputs/botones, `rounded-xl` en cards y contenedores de tabla, `rounded-full` en badges).

## 3. Inventario real de componentes de `components/ui`

**Actualización posterior a la versión 1.0**: ya no son 6, sino **9 archivos** — `DataTable.tsx`, `Badge.tsx` y `ErrorAlert.tsx` se agregaron con posterioridad.

| Componente | Base | Notas |
|---|---|---|
| `button.tsx` | `@base-ui/react/button` + `cva` | Sin cambios |
| `card.tsx` | div + slots | Sin cambios — ahora también usado como contenedor de bloques del Dashboard (ver sección 6) |
| `input.tsx` | `<input>` | Sin cambios |
| `label.tsx` | shadcn estándar | Sin cambios |
| `select.tsx` | `@base-ui/react/select` | Sin cambios |
| `ConfirmDialog.tsx` | `@base-ui/react/alert-dialog` | Sin cambios |
| `DataTable.tsx` | `<table>` genérico | **Nuevo.** `columns: {header, render(row), className?}[]`, `data`, `getRowKey`, `emptyMessage?`. **19 de 20 tablas del proyecto migradas** — única excepción: `PurchasesTable.tsx` |
| `Badge.tsx` | `cva`, 3 variantes (`secondary`/`muted`/`accent`) | **Nuevo.** Coexiste con una segunda implementación en `components/common/Badge.tsx` (4 variantes, incluye `destructive`) — deuda de duplicación, no unificadas |
| `ErrorAlert.tsx` | `ComponentProps<'div'>`, API de `children` | **Nuevo**, era preexistente en el proyecto real (no se creó en esta sesión). Coexiste con `components/common/ErrorAlert.tsx` (API de `message`) |

**No existen todavía**: `Skeleton` (sí existe, pero en `components/common/`, sin ningún consumidor real), `EmptyState` (nunca se construyó como componente aparte — el mensaje de fila vacía vive dentro de `DataTable`), `Sheet`/panel lateral, `Dialog` genérico, `Pagination`, `Toast` propio.

## 4. Patrón real de página de listado (confirmado en `products`, `sales`, `inventory`, `users`, `reports`, `purchases`, `suppliers`, `categories`, `taxes`, `permissions`, `roles`)

Cada página de listado (`XxxPage.tsx`) repite, con variaciones menores, esta misma estructura JSX — no hay componente que la encapsule:

```
<div className="flex flex-col gap-4">
  <header con h1 + descripción + botón "Nuevo X">
  <XxxFilters ... />
  {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
  {isError && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">...</div>}
  {!isLoading && !isError && <XxxTable ... />}
</div>
```

Puntos verificados:
- El loading es **texto plano**, no hay skeletons en ningún módulo.
- El error es el mismo bloque `role="alert"` con clases `border-destructive/40 bg-destructive/10 text-destructive` repetido literalmente en cada página — candidato directo a extraer.
- El estado vacío se resuelve **dentro** de cada tabla (`emptyMessage` prop, texto centrado en una fila `colSpan`), no como componente separado.
- Las tablas (`ProductsTable`, `SalesTable`, `InventoryTable`, `UsersTable`, y las 8 tablas de `reports/components/*Table.tsx`) son HTML `<table>` a mano, cada una con su propio `columns` array, su propio wrapper `rounded-xl border bg-card`, su propia fila vacía y sus propias clases `border-b bg-muted/50` en el header. La estructura es idéntica byte a byte en el 90% de los casos; solo cambian columnas y celdas.
- Los badges de estado (`ProductStatusBadge`, `UserStatusBadge`) son **código duplicado literal** (mismas clases `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium` + misma lógica `active ? secondary : muted`). `UserRoleBadge` es una tercera variante casi idéntica con `bg-accent`.
- Los formularios (`ProductForm`, `UserForm`) usan React Hook Form + Zod + `Input`/`Select`/`Label` de `components/ui` directamente, sin componente `FormField` compartido — cada campo repite su propio bloque `<div className="flex flex-col gap-1.5"><Label/><Input/><FieldError/></div>`.
- Los filtros (`ProductFilters`, `UserFilters`, `SaleFilters`, `InventoryFilters`) comparten el mismo layout `flex flex-wrap items-end gap-3` con pares `Label`+`Input`/`Select`, pero cada uno es un archivo independiente sin componente `FilterBar` base.

## 5. Estado real de las Etapas 5.1–5.3 (formatCurrency / formatDateTime) — auditoría cerrada

Verificado por `grep` de imports reales y por revisión módulo por módulo de qué campos monetarios muestra cada tabla/formulario, no por lo que digan los comentarios de los propios archivos.

- `formatCurrency` se usa en:
  - `sales` (`SalesTable`, `CartSummary`, `ProductResults`)
  - `products` (`ProductsTable`)
  - `purchases` (`PurchasesTable`)
  - 6 de las 8 tablas de `reports`
- `formatDateTime` se usa en:
  - `SalesTable`
  - `UsersTable`

### Conclusión definitiva

1. **Los módulos que no muestran valores monetarios no requieren `formatCurrency`.**

`suppliers`, `settings`, `taxes` y `categories` no muestran columnas monetarias.

`InventoryTable` únicamente muestra cantidades y punto de reorden, por lo que tampoco requiere dicho helper.

2. **Los campos editables vinculados a formularios tampoco deben usar `formatCurrency`.**

`PurchaseItemsField`, `openingAmount` y `closingAmount` utilizan `Input type="number"` con React Hook Form.

Aplicar `formatCurrency` rompería el flujo de edición al convertir el valor numérico en texto formateado.

3. **No se encontraron inconsistencias restantes en la consolidación de `formatCurrency`.**

El último caso pendiente (`PurchasesTable.tsx`) fue migrado para utilizar `utils/formatCurrency`, eliminando el `Intl.NumberFormat` local.

Con esto queda cerrada la auditoría de formateo monetario del proyecto.

> Nota:
>
> La adopción de `formatDateTime` continúa siendo parcial (actualmente 2 módulos). No forma parte del alcance de la consolidación de moneda y queda abierta para una futura auditoría.

## 6. Estado final de la Etapa 5.5 (verificado contra el código en esta sesión, corrige la versión anterior de este documento)

**Corrección importante**: la versión anterior de esta sección afirmaba "cero `<table>` manual fuera de `DataTable.tsx`" y que `UsersTable.tsx` seguía con badge inline. **Ninguna de las dos afirmaciones se sostuvo al reverificar.**

### Estado real, verificado por `grep` en esta sesión

1. ✅ **`Badge`** — 10 consumidores reales, cero badges inline restantes en todo el proyecto. Existe en dos ubicaciones (`components/common/Badge.tsx`, 4 consumidores; `components/ui/Badge.tsx`, 6 consumidores) — deuda de duplicación, no de funcionalidad faltante.
2. ✅ **`ErrorAlert`** — 11 consumidores dentro del alcance aprobado (10 páginas de `reports/pages/` + `src/pages/DashboardPage.tsx`), en `components/common/`. Coexiste con `components/ui/ErrorAlert.tsx` (API distinta, `children` en vez de `message`), con sus propios consumidores preexistentes fuera de este alcance.
3. 🔶 **`DataTable`** — **19 de 20 tablas migradas, no 20 de 20 como se afirmó antes.** Única excepción real: `PurchasesTable.tsx`, que sigue con `<table>` manual.
4. ✅ **`FilterBar`** — 10 de 10 consumidores, completo.
5. ✅ **`PageHeader`** — 11 consumidores, misma composición que `ErrorAlert`.
6. ✅ **`KpiCard`** — 1 de 1 consumidor (`DashboardSummaryCards.tsx`), completo.
7. ⏳ **`Skeleton`** — existe (`components/common/Skeleton.tsx`), **cero consumidores reales** — el loading del proyecto sigue siendo texto plano en el 100% de las páginas. No es deuda técnica: no reemplaza nada existente, aplicarlo es UX nueva.
8. ⏳ **`Sheet`** — nunca se construyó. Sin consumidor real todavía (mismo motivo que en la v1.0 de este documento).

`UsersTable.tsx` **ya no tiene ningún badge inline** — fue reconstruida sobre `DataTable`, con `UserStatusBadge.tsx` (nuevo, sobre `components/ui/Badge` por consistencia con `UserRoleBadge.tsx` del mismo módulo) como su badge de estado.

`PurchasesTable.tsx` **ya tiene su badge de estado migrado** a `Badge` (`components/common/Badge`, único con variante `destructive`, necesaria para `CANCELLED`) — corregido en esta sesión. Lo que **no** se migró es la tabla en sí: sigue siendo `<table>` manual, no `DataTable` (punto 3 arriba).

## 6-bis. Patrones visuales nuevos — Etapa 5.7 (Dashboard)

Confirmados en `src/pages/DashboardPage.tsx` y sus componentes nuevos:

- **`Card`/`CardHeader`/`CardTitle`/`CardContent`** (`components/ui/card.tsx`, ya existente) como contenedor estándar de cada bloque informativo del Dashboard — mismo componente ya usado por `KpiCard`/`CartSummary`/`CheckoutPanel`, sin ninguna variante nueva.
- **KPIs**: `DashboardSummaryCards` sobre `KpiCard`, sin cambios respecto a la Etapa 5.5.
- **Gráficos**: `recharts` (`BarChart`), primer uso real en todo el proyecto — `SalesByCategoryChart.tsx`. Usa `--chart-1` (token ya definido desde el inicio del proyecto, sin consumidor hasta ahora) como color de barra, y `formatCurrency` (ya existente) para formatear ejes y tooltip — ningún formateador nuevo.
- **Alertas compactas**: patrón nuevo, confirmado en `LowStockAlert.tsx`/`PendingPurchasesAlert.tsx` — **ícono (`lucide-react`) + texto resumen de una línea + botón "Ver"**, sin `Card` propio (el wrapper lo decide quien los use), sin navegación interna (`onViewAll: () => void` como callback). Ambos componentes de presentación pura: reciben datos por props, sin hooks ni llamadas a API.
- **Queries independientes**: el Dashboard llama a 4 hooks (`useDashboard`, `useSalesByCategory`, `useLowStock`, `usePurchases`) de forma independiente, cada uno con su propio `isLoading`/`isError` — si uno falla, no bloquea a los demás. Patrón nuevo respecto al resto del proyecto (donde cada página típicamente tiene una sola query).

**Componentes existentes mantenidos sin cambios en esta etapa**: `Badge`, `ErrorAlert`, `PageHeader`, `Card`, `KpiCard`, `FilterBar`, `DataTable`.

## 7. Convenciones confirmadas (para módulos nuevos: Compras, POS, Caja, Reportes que faltan)

- Un módulo = una carpeta en `src/features/<modulo>` con subcarpetas `api/`, `components/`, `hooks/`, `pages/`, `schemas/`, `types/` (algunos añaden `utils/` cuando el módulo lo necesita: `products`, `purchases`, `sales`).
- Nomenclatura de archivos confirmada: `<modulo>.api.ts`-style dentro de `api/`, `XxxPage.tsx` / `CreateXxxPage.tsx` / `EditXxxPage.tsx` dentro de `pages/`, `XxxTable.tsx` (ahora sobre `DataTable`), `XxxFilters.tsx`, `XxxForm.tsx`, `XxxStatusBadge.tsx` (ahora sobre `Badge`) dentro de `components/`.
- Las páginas nunca llaman Axios directamente — siempre vía hook (`useProducts`, `useCreateProduct`, etc.), tal como exige `FRONTEND_ARCHITECTURE.md` §3.3, y esto sí se cumple en el 100% del código revisado.
- Formularios: React Hook Form + Zod, un `schemas/xxx.schema.ts` por módulo.

## 8. Lo que este documento deja fuera a propósito

**Actualización posterior a la versión 1.0**: la paleta de marca (`--brand`, `--accent-amber`, `--accent-teal`) y el sidebar oscuro **ya están definidos e implementados** (Etapa 5.4/5.6) — ya no es una decisión pendiente. El POS (`PosLayout.tsx`, `SalesPOSPage.tsx` adaptada) tampoco está pendiente — ya tiene su propio layout y estructura de 3 columnas.

Sigue sin definir/construir: modo oscuro real (infraestructura cableada, sin punto de entrada en la UI), y componentes de UI propios de `cashSession`/`cashRegisters` (siguen sin componentes visuales más allá de tipos/hooks/api). Esas decisiones siguen siendo de producto, no de sistema de diseño.

---

**Estado de continuidad**: Etapas 5.4 a 5.7 cerradas. **Corrección (2026-08-02):** la referencia previa a un `docs/FRONTEND_ROADMAP.md` era un enlace roto — ese archivo nunca existió en el repositorio (ver `CLAUDE.md`, que ya aclaraba lo mismo para `FRONTEND_ARCHITECTURE.md`). El bloqueo que describía ("gráfico de ventas de 7 días bloqueado por limitación real de datos") **ya no existe**: `GET /reports/sales-by-date` fue implementado en el backend y el frontend ya lo consume (`useSalesByDate.ts`, `SalesByDateLineChart.tsx`, integrado en `DashboardPage.tsx` — ver `docs/BACKEND_REQUEST_sales-by-date.md`, marcado resuelto). `Sheet` sigue sin construirse por falta de caso de uso real — único punto de esta nota que sigue vigente.

---

## 9. Etapa 6 — Evolución del Design System (implementación iniciando en el POS)

Extiende el Design System existente — no lo reemplaza. Ningún token, paleta ni componente ya consolidado (`DataTable`, `Badge`, `ErrorAlert`, `LoadingState`, `PageHeader`, `FilterBar`, `KpiCard`, `Card`) se toca en esta etapa. Se agregan únicamente los componentes genéricos que el rediseño del POS requiere y que hoy no existen, directamente en `components/ui/`, para quedar disponibles de inmediato al resto de módulos cuando se rediseñen.

### 9.1 Componentes nuevos incorporados al Design System

**`PillGroup` / `Pill`** (`components/ui/PillGroup.tsx`)
- **Propósito:** selector exclusivo en fila horizontal, con la opción activa resaltada en color sólido de marca (`--brand`).
- **API conceptual:** `options: { value, label }[]`, `value`, `onChange` — controlado, sin estado interno.
- **Caso de uso en el POS:** filtro de categorías del catálogo.
- **Reutilizable en:** cualquier filtro de selección única en listados existentes (Productos, Compras, Reportes) como alternativa visual a los `Select` actuales cuando las opciones son pocas y se benefician de estar siempre visibles.

**`MediaCard`** (`components/ui/MediaCard.tsx`)
- **Propósito:** tarjeta con imagen (o placeholder) + título + subtítulo + acción — para catálogos visuales.
- **API conceptual:** `imageUrl?`, `title`, `subtitle?`, `actionLabel?`, `onAction?`, `onClick?`.
- **Caso de uso en el POS:** grilla de productos del catálogo.
- **Reutilizable en:** listado de Productos, si en el futuro se agrega imagen al modelo (hoy no existe ese campo — ver Bloque 3 del roadmap); cualquier catálogo visual futuro.

**`SegmentedControl`** (`components/ui/SegmentedControl.tsx`)
- **Propósito:** grupo de botones de selección única, con la opción activa en fondo sólido — mismo patrón visual que `PillGroup` pero pensado para grupos pequeños y fijos (2-4 opciones), no para listas de filtro.
- **API conceptual:** `options: { value, label }[]`, `value`, `onChange` — controlado.
- **Caso de uso en el POS:** método de pago (`CheckoutPanel`), tipo de descuento (%/€).
- **Reutilizable en:** cualquier selector exclusivo de 2-4 opciones en formularios existentes (ej. tipo de reporte, unidad de medida).

**`StatusDot`** (`components/ui/StatusDot.tsx`)
- **Estado:** Pendiente de implementación.
- **Propósito:** punto de color + texto para representar estados binarios (on/off).
- **Implementación:** se incorporará al Design System únicamente cuando exista un segundo caso de uso real que justifique extraerlo como componente compartido.
- **Mientras tanto:** el indicador de estado permanecerá implementado directamente en `PosHeader.tsx`.
- **Reutilizable en:** Dashboard, Caja u otros módulos que necesiten el mismo patrón visual.

### 9.2 Relación con el Design System existente

Ninguno de los 4 componentes nuevos duplica algo ya consolidado: `PillGroup` y `SegmentedControl` no reemplazan a `select.tsx` (siguen siendo la opción correcta para listas largas o formularios estándar); `MediaCard` no reemplaza a `card.tsx` (lo usa como base, mismo radio/sombra); `StatusDot` no reemplaza a `Badge`/`ActiveStatusBadge` (alcance distinto, ver arriba). Los 4 heredan paleta, radios y sombras ya definidos en `src/index.css` — sin ningún token nuevo.

### 9.3 Roadmap de implementación

1. **Header superior** — ✅ Completado (`PosHeader.tsx`, específico del POS).
2. **`PillGroup` + categorías del POS.**
3. **`MediaCard` + grilla de productos del POS** (con placeholder de imagen — el modelo `Product` no tiene campo de imagen hoy; queda preparado para incorporarla cuando el módulo de Productos lo soporte).
4. **`SegmentedControl` + método de pago** (`CheckoutPanel`).
5. ~~Cliente y descuento (usa `SegmentedControl` del bloque 4 para %/€; requiere confirmar primero si esta funcionalidad ya existe en el POS actual).~~ — **desactualizado:** el descuento de carrito ya usaba `SegmentedControl` desde antes de esta nota. La parte de "Cliente" se implementó por separado, fuera de este roadmap de componentes, en los Bloques 8.1–8.5 (`carniceria-pos-backend`/`carniceria-pos-front`, ver `ROADMAP.md`): selector de cliente en el "Header Operativo" (`PosHeader.tsx`, chip "Cliente" clicable) que abre `CustomerSearchDialog.tsx` (`features/customers/components/`, propio del módulo de Clientes, no un componente nuevo de este Design System — reutiliza `SearchInput`/`LoadingState`/`ErrorAlert` ya existentes).
6. ~~Espacio reservado para Facturación Electrónica — sin implementar~~ — **desactualizado:** la Facturación Electrónica real del sistema quedó integrada el 04/08/2026 vía Alegra (`carniceria-pos-backend`/`carniceria-pos-front`, Bloques 7.1–7.20 — ver `ROADMAP.md`), no vía el módulo `invoicing`/A-22 que este ítem anticipaba. **Sin cambios en el POS mismo** (`SaleReceiptDialog.tsx` — el modal de "Venta completada" — sigue siendo exclusivamente ticket local, sin ningún botón de Hacienda; la emisión es bajo demanda desde Ventas → Documentos, Bloque 7.17): las pantallas nuevas son Configuración → Facturación Electrónica → Alegra (Bloque 7.4) y, dentro de Ventas (administración) → pestaña "Documentos" (`SaleDetailContent.tsx`), los botones "Factura electrónica"/"XML"/"Reenviar" conectados (Bloques 7.16/7.17/7.20) más el diálogo `SaleResendDialog.tsx` (Bloque 7.20) — mismo lenguaje visual ya existente en esa pestaña (botón simple `variant="outline" size="sm"`, `Dialog.tsx` genérico), sin componentes nuevos en el Design System.
7. **Pulido visual final** — revisión completa contra la imagen...

Una vez concluida la Etapa 6 en el POS, los componentes incorporados al Design System servirán como base para el rediseño progresivo del Dashboard y del resto de módulos del sistema, manteniendo un lenguaje visual unificado.

---

## 10. Actualización — QA-005 a QA-008 (Compras, Productos, Notificaciones, Ventas)

**Fecha:** 26 de julio de 2026. Verificado directamente contra el código actual (`grep` de consumidores reales), no contra lo que documentaban las versiones anteriores de este archivo.

### 10.1 Correcciones a afirmaciones que ya no son ciertas

- **Sección 3, fila `Badge.tsx`**: decía *"Coexiste con una segunda implementación en `components/common/Badge.tsx`... deuda de duplicación, no unificadas"*. **Ya no es así**: `components/ui/Badge.tsx` no existe más en el repositorio — solo queda `components/common/Badge.tsx` (10 consumidores reales, cero badges inline). Sin deuda pendiente en este punto.
- **Sección 3, fila `ErrorAlert.tsx`**: decía *"Coexiste con `components/common/ErrorAlert.tsx` (API de `message`)"*. **Ya no es así**: `components/common/ErrorAlert.tsx` no existe más — solo queda `components/ui/ErrorAlert.tsx` (API de `children`), consumido en todo el proyecto.
- **Sección 6-bis (`Alertas compactas`, `LowStockAlert.tsx`/`PendingPurchasesAlert.tsx`)**: **ambos componentes fueron eliminados** (QA-006C) por quedar sin ningún consumidor — la tarjeta "Alertas" de `src/pages/DashboardPage.tsx` ya no arma su propia presentación con esos dos componentes ni con 4 queries independientes (`useDashboard`, `useSalesByCategory`, `useLowStock`, `usePurchases`); ahora consume `useNotifications()` + `NotificationPanel` (el mismo componente que ya usa la campana de notificaciones), eliminando una duplicación real de datos y de presentación entre el Dashboard y el Centro de Notificaciones. `useDashboard`/`useSalesByCategory` siguen consumiéndose de forma independiente para el resto de la página (KPIs, gráfico de categorías) — solo el bloque de alertas cambió de fuente.
- **Sección 3, "No existen todavía"**: decía *"...`Dialog` genérico, `Pagination`..."*. **Ambos ya existen**: ver 10.2 (`Dialog`) y `ProductsPage.tsx` (paginación real, con controles Página/Anterior/Siguiente, mismo patrón ya usado en los reportes paginados).

### 10.2 Componentes nuevos incorporados al Design System

**`Dialog`** (`components/ui/Dialog.tsx`) — primitivo de propósito general sobre `@base-ui/react/dialog` (mismo paquete que ya usa `select.tsx` y `ConfirmDialog.tsx` para `alert-dialog`). Cubre exactamente el vacío que la sección 3 señalaba ("no existe `Dialog` genérico") — `ConfirmDialog` sigue siendo el primitivo específico para confirmaciones destructivas, este es para cualquier otro contenido (formularios embebidos, búsquedas). Expone `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` — composición por `children`, mismo lenguaje visual (`rounded-xl border bg-card shadow-lg`, transiciones `data-[starting-style]`/`data-[ending-style]`) que `ConfirmDialog`. `DialogContent` admite `className`/`showHeader` opcionales para adaptarse a distintos contextos (diálogo flotante vs. embebido en una tarjeta) sin romper su uso por defecto.

**Patrón "buscador + creación rápida"** (`ProductSearchDialog.tsx`, `CategorySearchDialog.tsx` — module-local, en `features/purchases/` y `features/categories/` respectivamente, no en `components/ui/`) — reemplaza un `Select` con el catálogo completo cuando la lista puede crecer sin límite práctico (el `Select` tradicional solo puede mostrar una página del backend, quedando ciego al resto). Estructura común: header fijo con input de búsqueda (debounce ~300ms, mismo patrón ya usado en `SalesPOSPage.tsx`) + resultados con su propio scroll + acción "Crear nuevo" que cambia el contenido del mismo diálogo a un formulario de creación embebido (reutiliza el formulario completo del módulo — `QuickProductForm`/`CategoryForm` — sin duplicar su lógica de validación). Al crear con éxito, el nuevo registro se entrega por el mismo callback `onSelect` que los resultados de búsqueda.

**`QuickProductForm`** (`features/products/components/QuickProductForm.tsx`) — versión condensada de `ProductForm` para flujos incrustados en un diálogo (creación rápida de producto desde Compras): solo los campos que el schema de Zod ya marca obligatorios quedan siempre visibles; el resto vive detrás de un disclosure "Opciones avanzadas", cerrado por defecto. Mismo schema/validación que `ProductForm` (no hay una segunda regla de negocio) — solo cambia qué se muestra por defecto. Su footer (Cancelar/Guardar) vive **fuera** del propio `<form>` (en el diálogo contenedor), conectado vía el atributo HTML `form="quick-product-form"` — permite que el footer quede fijo, fuera del área con scroll, sin que el componente necesite saber que vive dentro de un diálogo.

**`ProductCategoryField` / `ProductTaxField`** (`features/products/components/`) — campos extraídos de `ProductForm.tsx` para que tanto el formulario completo como `QuickProductForm` compartan la misma lógica (y el mismo futuro cambio, si el selector de categoría/impuesto evoluciona) en un solo lugar. `ProductCategoryField` ya no es un `Select` — es un botón que abre `CategorySearchDialog`, resolviendo el nombre de la categoría ya elegida por su propio id (no contra una lista local que podría no contenerla, la misma causa raíz identificada en QA-005).

### 10.3 Relación con el Design System existente

Ninguno de los componentes de este bloque reemplaza algo ya consolidado: `Dialog` complementa a `ConfirmDialog` (alcance distinto: contenido general vs. confirmación destructiva); el patrón "buscador + creación rápida" complementa a `select.tsx` (sigue siendo la opción correcta para listas cortas y estables — impuestos, unidad de medida); `QuickProductForm` no reemplaza a `ProductForm` (páginas de administración completa siguen usándolo sin cambios). Se evaluó explícitamente generalizar `ProductSearchDialog`/`CategorySearchDialog` en un único componente parametrizable de `components/ui/` y se decidió no hacerlo todavía — mismo criterio que el resto de este documento aplica a `DataTable`/`Badge`: una abstracción compartida se justifica desde el tercer caso de uso real, no desde el segundo.

### 10.4 Paginación (nuevo estado, corrige la sección 3)

`ProductsPage.tsx` ahora es el primer listado del proyecto con paginación real controlada por el usuario (antes solo existía en los reportes). Mismo patrón ya usado ahí: leer `meta.page`/`totalPages`/`hasNext`/`hasPrev` de la respuesta y controles "Anterior"/"Siguiente". **No verificado todavía** en el resto de listados administrativos (Categorías, Proveedores, Impuestos, Usuarios, Roles) — quedan con el mismo riesgo latente que tenía Productos hasta este bloque (ver `AUDITORIA_FASE10_INFORME_EJECUTIVO.md`, sección 14.4).

---

## 11. Actualización — Integración de promociones en el POS (Bloque P.8) y corrección del límite de selectores de productos

**Fecha:** 27–28 de julio de 2026.

### 11.1 Componentes nuevos incorporados al Design System

**`CartPromotions`** (`features/sales/components/CartPromotions.tsx`) — sección "Promociones aplicadas" del POS, equivalente en vivo (antes de confirmar la venta) a la tabla "Descuentos aplicados" que ya muestra `SaleDetailContent.tsx` después de confirmar. Presentación pura: no calcula ningún monto, solo lee `SaleQuoteAppliedPromotion[]` (la respuesta de `POST /sales/quote`) y resuelve el nombre del producto afectado contra el propio `CartLine[]` cuando `lineIndex !== null`. Oculto por completo si no hay ninguna promoción aplicada — mismo criterio condicional que el resto de bloques opcionales del proyecto.

**`CartSummary`** (ya existente) — extendido con dos props nuevas: `automaticDiscountTotal` (fila "Promociones", separada de `discountAmount`/"Descuento", que sigue siendo exclusivamente el descuento manual) e `isUpdating` (indicador discreto `Loader2` — mismo ícono/patrón ya usado en `LoginForm.tsx` para el estado de carga de un botón — junto a "TOTAL" mientras `POST /sales/quote` recalcula en segundo plano, sin bloquear la edición del carrito).

**`CartItems`** (ya existente) — cada línea ahora puede mostrar precio tachado + monto ajustado en ámbar (`text-accent-amber`, mismo tono ya usado en `PosSidebar.tsx`) cuando la cotización indica una promoción activa sobre esa línea, correlacionando por posición con un chequeo defensivo de `productId` (para el caso transitorio en que `keepPreviousData` todavía muestra la cotización de una forma de carrito anterior mientras la nueva está en camino).

### 11.2 Patrón nuevo: `useQuery` + `placeholderData: keepPreviousData` para recálculo en vivo

Primer uso de `keepPreviousData` en el proyecto (`features/sales/hooks/useSaleQuote.ts`). Se usa exactamente para el caso al que está destinado: una entrada que cambia con cada edición del usuario (el carrito) pero cuyo resultado no debe "parpadear" a vacío mientras se recalcula — se sigue mostrando el último resultado válido hasta que llega el nuevo. Combinado con el mismo patrón de debounce (~300ms) ya usado para la búsqueda de productos (`SalesPOSPage.tsx`), aplicado esta vez al carrito/descuento completo en vez de a un campo de texto.

### 11.3 Corrección — límite de 20 productos en selectores (corrige la sección 10.2)

La sección 10.2 describía el patrón "buscador + creación rápida" (`ProductSearchDialog.tsx` y equivalentes) como el reemplazo del `Select` tradicional "cuando la lista puede crecer sin límite práctico". Eso seguía siendo cierto solo **mientras el usuario escribía un término de búsqueda** — sin buscar, el diálogo llamaba a `useProducts()` sin `limit`, así que el `DEFAULT_LIMIT = 20` del backend seguía capando el catálogo visible al abrir el diálogo (mismo síntoma raíz que QA-005, en un lugar que QA-005 no llegó a corregir). Corregido enviando `limit: 100` (el techo real del backend, `MAX_LIMIT`, sin tocar `DEFAULT_LIMIT`/`MAX_LIMIT` ni el backend) en los **7 lugares reales** del proyecto donde `useProducts()` actúa como selector de "cualquier producto del catálogo": `ProductSearchDialog.tsx`, `PurchaseForm.tsx`, `PurchaseDetailPage.tsx`, `InventoryPage.tsx`, `InventoryWastesPage.tsx`, `PromotionForm.tsx` (normalizado de `limit: 200`, que ya funcionaba pero era una magnitud inconsistente), `SalesPOSPage.tsx`. `ProductsPage.tsx` (sección 10.4, paginación real) no se tocó — no es un selector, es el listado administrativo completo.

### 11.4 Sistema de temas (claro/oscuro) — `ThemeProvider` (Bloque 5, `carniceria-pos-desktop`)

`src/components/common/theme-provider.tsx` envuelve `next-themes` (`^0.4.6`, único componente/dependencia del sistema de temas — no hay lógica propia de tema en ningún otro archivo). Montado una sola vez en `src/main.tsx`, sin overrides en el call site — los valores del propio archivo son los que rigen:

```tsx
<NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} {...props}>
```

**Causa raíz corregida (2026-08-03):** con la configuración anterior (`defaultTheme="system"` + `enableSystem`), sin ninguna preferencia guardada en `localStorage["theme"]`, `next-themes` resolvía el tema vía `prefers-color-scheme` del sistema operativo/navegador — mismo build, pero cada entorno (localhost, con un perfil de navegador que ya tenía `"theme":"light"` guardado de sesiones anteriores, vs. la app de Electron, con un `userData` nuevo sin esa clave) terminaba en un tema distinto según el SO de esa máquina, no según ninguna decisión de la app — el ERP instalado abría en oscuro mientras localhost abría en claro. `defaultTheme="light"` + `enableSystem={false}` fija claro como el valor de arranque real y explícito, igual en cualquier entorno que sirva este mismo build (web o `app://bundle` de Electron), sin depender de `prefers-color-scheme` ni de ninguna configuración de Electron. Ningún archivo del repositorio de escritorio necesitó cambios — la causa era 100% de este componente.

No existe todavía ningún selector de tema manual en la UI (`grep` de `setTheme`/`ThemeToggle` en `src/` no encuentra nada fuera del propio provider) — el único punto de entrada al tema es este archivo. Si en el futuro se agrega un selector manual, `next-themes` sigue persistiendo esa elección en `localStorage["theme"]` automáticamente (verificado: fijar `localStorage.setItem('theme', 'dark')` y recargar aplica y mantiene el tema oscuro correctamente) — este componente solo decide el valor de arranque cuando todavía no hay ninguna preferencia guardada, sin cambios adicionales necesarios para que un selector futuro funcione.

Validado en los cuatro entornos relevantes, mismo build, todos partiendo sin `localStorage["theme"]`: localhost (`vite dev`), Electron en desarrollo (`npx electron .`, sirviendo `app://bundle/`), la app instalada en su primer arranque, y la app instalada en un segundo arranque — los cuatro renderizan `<html class="light">` de entrada, sin parpadeo al tema equivocado.

### 11.5 Relación con el Design System existente

Ningún componente de este bloque reemplaza algo ya consolidado: `CartPromotions` es nuevo porque no existía ninguna superficie de promociones dentro del POS antes de este bloque; `CartSummary`/`CartItems` se extendieron con props opcionales, sin cambiar su contrato existente para quien ya los consumía. El patrón `keepPreviousData` queda documentado aquí como precedente para cualquier futuro "recálculo en vivo" del proyecto — no se generalizó a un hook compartido todavía (mismo criterio de "abstracción compartida se justifica desde el tercer caso de uso real" ya aplicado en el resto de este documento).