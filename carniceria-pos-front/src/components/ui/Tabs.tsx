import * as React from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'

import { cn } from '@/lib/utils'

/**
 * components/ui/Tabs.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — primer consumidor: no existía ningún componente de
 * pestañas en el ERP (`docs/UI_DESIGN_SYSTEM.md` no lo lista junto a
 * Skeleton/Sheet/Dialog genérico). Envoltorio delgado sobre
 * `@base-ui/react/tabs` (misma librería base que `select.tsx`/
 * `ConfirmDialog.tsx`), mismo criterio de estilo que el resto de
 * `components/ui`: sin lógica propia, solo clases Tailwind sobre los
 * primitivos ya accesibles de base-ui (roles/keyboard nav/`aria-selected`
 * los resuelve la librería).
 *
 * Reutilizable por cualquier módulo del ERP, no exclusivo de Compras.
 */
function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'relative flex items-center gap-1 border-b border-border',
        className,
      )}
      {...props}
    />
  )
}

function TabsTab({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        'relative -mb-px cursor-pointer border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none',
        'hover:text-foreground',
        'data-[selected]:border-brand data-[selected]:text-brand',
        'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-t-md',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn('pt-4 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTab, TabsPanel }
