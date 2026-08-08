import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/features/auth/api/auth.api'
import { DashboardHeader } from '@/components/common/DashboardHeader'
import { Sidebar } from '@/components/common/Sidebar'
import { performLogout } from '@/lib/htpp/logoutManager'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: ReactNode
  /** Pulido visual (aprobado, "recuperar el espacio inferior que falta
   * para eliminar el scrollbar del Canvas Workspace de Crear/Editar
   * Producto"): reduce el padding inferior del área de contenido
   * (`pb-8`→`pb-3`). Opcional y aditivo, por defecto `false` — ninguna
   * otra página cambia. El padding superior/lateral (`p-8`) no se toca,
   * solo el inferior, que es "aire" de página, no parte de ningún
   * componente del Workspace. */
  compactBottomSpacing?: boolean
}

/**
 * layouts/DashboardLayout.tsx
 * -----------------------------------------------------------------------------
 * El logo/nombre del sistema y el bloque de usuario + "Cerrar sesion"
 * (antes en un `<header>` propio aca) ahora viven en `Sidebar.tsx`, como
 * navegacion permanente — mismos datos (`user`), mismo `handleLogout`
 * (misma secuencia `authApi.logout()` -> `performLogout()` ->
 * `navigate('/login')`), sin logica nueva: este layout sigue siendo quien
 * los resuelve, solo cambia quien los renderiza.
 *
 * Estabilidad de sesion, Bloque 3: `performLogout()` (`lib/htpp/logoutManager.ts`)
 * reemplaza la secuencia manual `queryClient.cancelQueries()` +
 * `queryClient.clear()` + `authStore.logout()` que antes solo vivia aca —
 * ahora es el mismo helper que usa el logout automatico del interceptor
 * de Axios (`client.ts`) ante un refresh fallido, garantizando que ambos
 * flujos limpien el estado del cliente de forma identica. Lo unico que
 * sigue siendo exclusivo de este logout manual es `authApi.logout()`
 * (revocar el refresh token en el servidor) — el automatico no lo llama
 * porque ya fallo un refresh, es decir el refresh token ya es invalido o
 * esta revocado en el servidor (ver docstring de `logoutManager.ts`).
 *
 * Layout "panel flotante" (rediseño aprobado): sidebar y contenido ya no
 * son dos rectangulos pegados de borde a borde. Un contenedor comun con
 * padding (`p-3`) le da a ambos un pequeño margen exterior compartido, y
 * `gap-3` los separa mediante espacio negativo (no un borde ni un
 * degradado de color). El `<main>` es una tarjeta propia con esquinas
 * redondeadas y sombra ambiental suave (elevacion, no una sombra
 * direccional tipo "muro" — esa se elimino del lado del Sidebar).
 *
 * Unificacion visual con el POS (aprobado, referencia oficial =
 * `PosLayout.tsx`): mismo radio (`rounded-2xl`) y misma sombra ambiental
 * en `<main>` (`bg-pos-content`, el mismo token que ya usa el panel de
 * contenido del POS). Puro ajuste de geometria/color de layout: cero
 * cambios de datos, rutas o logica.
 *
 * Pulido visual final (aprobado, "misma calidad y lenguaje que el POS"):
 * el lienzo de fondo pasa de `bg-sidebar` (rojo-marron oscuro, fijo, sin
 * seguir el toggle claro/oscuro) a `bg-muted` — mismo token generico que
 * ya usa el resto del Backoffice claro, para que el espacio entre
 * `Sidebar.tsx` y `<main>` (ambos ahora superficies claras) no deje un
 * borde oscuro visible. Mismo criterio que `PosLayout.tsx`, que ya usa un
 * lienzo claro (`--pos-bg`) detras de sus dos superficies flotantes.
 *
 * Contenedor raiz `h-screen` (no `min-h-screen`) + `min-h-0` (fix de
 * scroll, alineado con `PosLayout.tsx` que ya usaba este mismo patron):
 * un flex item sin `min-h-0` tiene `min-height: auto`, es decir nunca se
 * encoge por debajo de la altura de su propio contenido aunque tenga
 * `overflow-y-auto` — con `min-h-screen` en el contenedor (un piso, no un
 * techo) esto dejaba crecer TODA la fila (Sidebar incluido, que solo se
 * estira por `align-items: stretch` para igualar la altura de la fila)
 * por encima del viewport cada vez que una pagina con `children` largos
 * (tablas, formularios) superaba el alto disponible — de ahi el scroll
 * vertical de toda la aplicacion, sin relacion alguna con el contenido
 * propio del Sidebar. Con `h-screen` la fila queda fija al alto de
 * pantalla y `min-h-0` permite que el contenido se encoja hasta ese
 * limite.
 *
 * Rediseño de layout (aprobado): `<main>` pasa a `flex flex-col` —
 * `DashboardHeader.tsx` (nuevo, ver su propio comentario) queda fijo
 * arriba (`shrink-0`, dentro del propio Header) y solo el `<div>` de
 * contenido de abajo scrollea (`min-h-0 flex-1 overflow-y-auto`, el mismo
 * fix de siempre, ahora en el hijo en vez de en `<main>`) — mismo
 * criterio "header fijo + body con scroll" que `WorkspacePanel.tsx`.
 * `Sidebar.tsx` ya no recibe `userFullName`/`userRole`/`onLogout`: esos
 * props se resuelven exactamente igual aca, solo se los pasa a
 * `DashboardHeader` en vez de a `Sidebar` (el bloque de usuario se mudo
 * de componente, no la logica que lo resuelve).
 */
export function DashboardLayout({
  children,
  compactBottomSpacing = false,
}: DashboardLayoutProps) {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } finally {
      await performLogout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-screen gap-3 bg-muted p-3">
      <Sidebar />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-pos-content shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]">
        <DashboardHeader
          userFullName={user?.fullName ?? ''}
          userRole={user?.role ?? ''}
          onLogout={handleLogout}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn('p-8', compactBottomSpacing && 'pb-3')}>{children}</div>
        </div>
      </main>
    </div>
  )
}
