# Carnicería POS — Frontend

Frontend de un sistema POS/ERP para una carnicería. React 19 + TypeScript + Vite, consumiendo un backend separado (`carniceria-pos-backend`, no incluido en este repositorio) vía `VITE_API_URL` (ver `.env`).

## Estado del proyecto (07/08/2026 — Release Candidate)

El **rediseño UX/UI integral del ERP** (ejecutado módulo por módulo) está **completo** — los 14 módulos administrativos más el POS ya fueron rediseñados y aprobados. **La etapa de estabilización del backend quedó oficialmente cerrada el 2026-08-03**, **Facturación Electrónica (Alegra) y el Módulo de Clientes quedaron cerrados el 2026-08-04**, **la revisión integral de QA módulo por módulo (QA.1–QA.16B) quedó cerrada el 2026-08-05**, y **la auditoría de producción de la aplicación de escritorio Electron (QA.APP.1–QA.APP.6, repositorio hermano `carniceria-pos-desktop`) también cerró el 2026-08-05**. **Release Candidate — versión real publicada más reciente: 1.0.8; versión 1.0.10 generada localmente (07/08/2026), todavía no publicada** — incluye los Bloques 1-3 de la auditoría de riesgos críticos antes de V1 (ver `ROADMAP.md`, sección "VERSIÓN 1.0.10"). **La validación CABYS↔Impuesto — el único riesgo fiscal real que quedaba pendiente para el cierre formal de la V1 — quedó COMPLETADA (07/08/2026)**, validada contra la aplicación Desktop real (el instalador 1.0.10 ya generado es anterior a este bloque y todavía no lo incluye). **El Hallazgo 1 de Promociones acumulables (`amountApplied` inflado con promociones `stackable`) también quedó ✅ CERRADO (07/08/2026)** — backend-only, cero cambios en este repositorio; el Hallazgo relacionado de precisión monetaria sigue documentado como riesgo teórico, sin caso reproducible. Ver [`ROADMAP.md`](./ROADMAP.md) para el detalle completo de cada bloque, y [`CLAUDE.md`](./CLAUDE.md) — sección **"CONTEXTO PARA CONTINUAR EL PROYECTO"**, al final del archivo — para retomar el trabajo sin depender de ningún historial de chat.

Resumen rápido:
- **Rediseñados (todos los módulos):** Dashboard, Productos, Categorías, Impuestos, Proveedores, Inventario, Promociones, Compras, Ventas (administración), Caja, Usuarios, Roles, Reportes, POS (Punto de Venta).
- **Estabilización del backend — CERRADA (2026-08-03).**
- **Facturación Electrónica (Alegra) y Módulo de Clientes — CERRADOS (2026-08-04).**
- **QA integral por módulos, QA.1–QA.16B — CERRADO (2026-08-05).** El ERP está listo para producción; ver `ROADMAP.md` para la tabla completa de bugs reales encontrados y corregidos.
- **Auditoría de producción de Electron, QA.APP.1–QA.APP.6 — CERRADO (2026-08-05), Release Candidate.** Repositorio `carniceria-pos-desktop` (hermano de este); 6 bugs reales encontrados y corregidos ahí (los últimos dos, QA.APP.5/QA.APP.6, descubiertos ya usando versiones reales publicadas), cero cambios en este repositorio.
- **Hallazgos reales de una instalación Electron ya actualizada varias veces (05/08/2026, publicados en la 0.1.7):** un permiso agregado después del primer arranque de una instalación (Clientes) nunca le llegaba en ninguna actualización — corregido separando el bootstrap idempotente de `Permission`/`Role`/`RolePermission` del seed completo (backend + `carniceria-pos-desktop`, cero cambios en este repositorio); y dos hallazgos de Facturación Electrónica (CABYS inválido rechazado por Alegra, timeout real dejando una venta "Pendiente" con riesgo de doble emisión). **Un tercer hallazgo relacionado (Bloque 7.23, mismo día):** la propia reconciliación del timeout tenía un falso negativo real — corregido y validado de extremo a extremo contra la aplicación de escritorio instalada real, todavía no publicado como nueva versión oficial (0.1.7 sigue siendo la publicada) — ver `ROADMAP.md`, secciones "AUDITORÍA DE ELECTRON PARA PRODUCCIÓN" y "FACTURACIÓN ELECTRÓNICA".
- **Validación CABYS↔Impuesto — ✅ COMPLETADA (07/08/2026).** El catálogo CABYS almacena ahora el `taxIndicator` real del BCCR; el backend valida la coherencia CABYS↔impuesto al crear/editar productos (`ValidationError`, protección final); el formulario muestra además el impuesto oficial y un indicador visual de coincidencia, puramente preventivo. Validado contra la aplicación Desktop real. Ver `ROADMAP.md`, sección "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO".
- **Pendiente antes de la versión 1.0 (exclusivamente del lado del ERP, no de Electron):** una ronda de escritura real contra Alegra con autorización explícita, y verificación final de un hallazgo histórico de UI (A-17) — ver `ROADMAP.md`, "ROADMAP OFICIAL HACIA LA VERSIÓN 1.0".

## Estructura general

```
src/
  components/ui/       # primitivos genéricos (button, DataTable, Dialog, Popover, MediaCard...)
  components/common/   # compartidos con lógica de dominio liviana (Badge, Toolbar, Sidebar, Can...)
  features/<módulo>/   # un directorio por dominio (auth, products, categories, taxes, suppliers,
                        # customers, inventory, batches, promotions, purchases, sales, returns,
                        # cashRegisters, cashSession, users, roles, permissions, reports, settings,
                        # notifications, documents, audit)
                        # — cada uno con su propio api/, components/, hooks/, pages/, schemas/, types/
  layouts/              # DashboardLayout (Backoffice) y PosLayout (POS, identidad visual propia)
  routes/               # todas las rutas, declaradas manualmente en routes/index.tsx
  stores/               # Zustand — authStore (global, autenticación). El único otro store del
                        # proyecto, cashSessionStore, vive junto a su módulo: features/cashSession/store/
  lib/                  # httpClient + refresh de sesión (lib/htpp/), queryClient, utils (cn)
  utils/                # formatCurrency, formatDateTime, formatQuantity, stockStatus
docs/
  UI_DESIGN_SYSTEM.md               # tokens, inventario de components/ui, convenciones de diseño
  AUDITORIA_FASE10_INFORME_EJECUTIVO.md  # auditoría técnica histórica del roadmap de funcionalidad de
                                          # negocio (Fases 1-17) — snapshot, no se actualiza en cada bloque
CLAUDE.md      # fuente de verdad del proyecto: arquitectura, metodología, reglas, decisiones tomadas —
               # incluye "CONTEXTO PARA CONTINUAR EL PROYECTO" para retomar sin el historial del chat
ROADMAP.md     # estado vigente: rediseño UX/UI, QA integral (QA.1–QA.16B), auditoría de Electron
               # (QA.APP.1–QA.APP.4), roadmap de negocio, deuda técnica, roadmap hacia la v1.0
CHANGELOG.md   # historial de mejoras implementadas
```

Ver `CLAUDE.md` para el detalle completo de convenciones (flujo de datos Page → hook → api → httpClient, React Query, auth/permisos, formularios, componentes reutilizables) antes de hacer cambios estructurales.

## Comandos

```
npm run dev       # servidor de desarrollo (Vite)
npm run build     # tsc -b && vite build (type-check + build)
npm run lint      # eslint .
npm run preview   # preview del build de producción
npm run serve     # sirve dist/ en el puerto 4173 (npx serve)
```

No hay test runner configurado en este proyecto (sin script de test, sin archivos de test). La verificación estándar de cada cambio es `tsc -b` + `eslint` + `npm run build`.
