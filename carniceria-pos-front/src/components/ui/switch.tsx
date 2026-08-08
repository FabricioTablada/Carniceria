import * as React from 'react'
import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '@/lib/utils'

/**
 * Bloque COST-05: primer Switch del proyecto — no existia ninguno en
 * `components/ui/` (los booleanos del formulario de Productos usan
 * `<input type="checkbox">`, ver `ProductForm.tsx`). Se pidio
 * explicitamente un Switch para "Aplicar merma esperada al costo", asi que
 * se construye siguiendo el mismo patron ya usado por `select.tsx`
 * (envoltorio delgado sobre una primitiva de `@base-ui/react`, con
 * `data-slot` y clases via `cn()`, sin logica propia).
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors outline-none',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        'data-[checked]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform',
          'data-[checked]:translate-x-[18px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
