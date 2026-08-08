import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

/**
 * `defaultTheme="light"` + `enableSystem={false}` a propósito (Bloque 5):
 * con `"system"` + `enableSystem`, sin una preferencia guardada en
 * `localStorage["theme"]`, next-themes resuelve el tema vía
 * `prefers-color-scheme` del sistema operativo/navegador — mismo bundle,
 * pero cada entorno (localhost vs. la app de Electron, con su propio
 * perfil de `userData` sin esa clave) terminaba en un tema distinto según
 * el SO de esa máquina, no según ninguna decisión de la app. Claro es
 * ahora el default real y explícito, igual en cualquier entorno que sirva
 * este mismo build. Si en el futuro se agrega un selector de tema manual,
 * `next-themes` sigue persistiendo esa elección en `localStorage["theme"]`
 * sin cambios acá — este archivo solo fija el valor de arranque cuando
 * todavía no hay ninguna preferencia guardada.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}