import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

/**
 * Bloque 7.26 (rediseño del Login + Sesión bloqueada, foto definitiva
 * 05/08/2026): ruta fija dentro de `public/` — Vite copia esa carpeta
 * tal cual, sin hashear nombres de archivo (a diferencia de un `import`
 * desde `src/assets`, que si lo hace y obligaria a recompilar para
 * cambiar el asset). Reemplazar el archivo en esa ruta alcanza para
 * poner una foto distinta — sin tocar este ni ningun otro archivo de
 * codigo. Asset actual generado por IA — decision explicita del usuario
 * que reemplaza la restriccion original de "solo fotografia real" (ver
 * ROADMAP.md, Bloque 7.26, "Decisión 8"). Formato PNG (no WebP): no hay
 * codificador WebP disponible en el proyecto sin agregar una libreria
 * nueva, fuera de alcance de este bloque — el nombre es equivalente,
 * autorizado explicitamente por el usuario.
 */
const AUTH_BACKGROUND_PATH = '/login-background.png'

/** Bloque 7.26: capas de fondo — la foto real primero, degradados de
 * respaldo debajo (se ven si el archivo no existe o falla la carga). */
const AUTH_BACKDROP_LAYERS = [
  `url(${AUTH_BACKGROUND_PATH})`,
  'radial-gradient(85% 65% at 22% 20%, oklch(0.28 0.1 24 / 55%), transparent 60%)',
  'radial-gradient(70% 60% at 78% 15%, oklch(0.16 0.05 24 / 50%), transparent 65%)',
  'radial-gradient(90% 70% at 50% 100%, oklch(0.12 0.03 24 / 60%), transparent 60%)',
  'repeating-linear-gradient(115deg, oklch(1 0 0 / 2.5%) 0 2px, transparent 2px 7px)',
  'linear-gradient(175deg, oklch(0.15 0.018 24) 0%, oklch(0.04 0.008 24) 100%)',
].join(', ')

/**
 * Bloque 7.33 (ajuste visual menor, aprobado): la foto quedaba demasiado
 * desenfocada y la viñeta demasiado presente — los cortes de carne casi
 * no se apreciaban. Viñeta suavizada (transparent al 50% en vez de 45%,
 * tope 100% al 24% en vez de 30%) y capa pareja más liviana (16%→34% en
 * vez de 22%→42%) — la legibilidad del formulario la sigue garantizando
 * `bg-card/90` + `backdrop-blur-md` de la propia tarjeta (sin cambios),
 * no este overlay.
 */
const AUTH_OVERLAY_LAYERS = [
  'radial-gradient(120% 90% at 50% 45%, transparent 50%, oklch(0.03 0 0 / 24%) 100%)',
  'linear-gradient(180deg, oklch(0.02 0 0 / 16%) 0%, oklch(0.02 0 0 / 34%) 100%)',
].join(', ')

/**
 * Bloque 7.26: pieza de fondo compartida entre `AuthLayout` (Login) y
 * `LockScreen` (Sesión bloqueada) — misma foto, mismo overlay, mismo
 * blur; la única diferencia entre esas dos pantallas es el contenido de
 * la tarjeta que se monta encima. `absolute inset-0`: agnóstico a que el
 * contenedor padre sea `relative` (AuthLayout) o `fixed` (LockScreen) —
 * en ambos casos ya cubre el viewport completo.
 */
export function AuthBackdrop() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: AUTH_BACKDROP_LAYERS,
          backgroundSize: 'cover, auto, auto, auto, auto, auto',
          backgroundPosition: 'center 35%, 0 0, 0 0, 0 0, 0 0, 0 0',
          backgroundRepeat: 'no-repeat, repeat, repeat, repeat, repeat, no-repeat',
        }}
      />
      {/* Bloque 7.33: blur reducido ~50% (10px → 5px) — la carne debe
          percibirse con claridad, el formulario sigue siendo el elemento
          principal gracias al overlay + la propia tarjeta, no al blur. */}
      <div
        className="absolute inset-0 backdrop-blur-[5px] backdrop-saturate-[105%]"
        style={{ backgroundImage: AUTH_OVERLAY_LAYERS }}
      />
    </>
  )
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <AuthBackdrop />
      <div className="relative z-10 w-full max-w-sm px-4">{children}</div>
    </main>
  )
}
