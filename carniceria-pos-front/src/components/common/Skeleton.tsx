import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * components/common/Skeleton.tsx
 * -----------------------------------------------------------------------------
 * A diferencia de `Badge.tsx`/`ErrorAlert.tsx`, este componente NO deduplica
 * nada existente: hoy no hay ningun estado de carga visual en el proyecto,
 * solo texto plano (`<p className="text-sm text-muted-foreground">
 * Cargando...</p>`), confirmado por busqueda exhaustiva antes de escribir
 * este archivo. Es una primitiva nueva, no una extraccion.
 *
 * Presentacion pura: un `<div>` que reutiliza unicamente tokens/utilidades
 * ya existentes en el proyecto — `bg-muted` (mismo token de superficie
 * neutra que usa el resto de la app) y `animate-pulse` (utilidad nativa de
 * Tailwind, sin ninguna dependencia nueva). No define ninguna variante de
 * tamano ni de forma: el tamano/forma de cada placeholder se controla por
 * `className` desde donde se use (mismo criterio que el `Skeleton` estandar
 * de shadcn/ui, sin modificaciones).
 *
 * Vive en `components/common/`, junto a `Can.tsx`, `Badge.tsx` y
 * `ErrorAlert.tsx` — no se crea ninguna carpeta nueva.
 */

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}