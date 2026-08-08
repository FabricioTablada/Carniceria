import { cn } from '@/lib/utils'

interface KbdHintProps {
  children: string
  className?: string
}

/**
 * components/ui/KbdHint.tsx
 * -----------------------------------------------------------------------------
 * Etiqueta visual discreta para atajos de teclado (F2, F4, etc.), estilo
 * "badge de teclado". Puramente decorativa: no registra ningun listener ni
 * dispara ninguna accion por si misma — el atajo real se maneja donde vive
 * la logica correspondiente (SalesPOSPage.tsx, PosLayout.tsx).
 */
export function KbdHint({ children, className }: KbdHintProps) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex min-w-[1.5rem] select-none items-center justify-center rounded-md border border-b-2 bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
