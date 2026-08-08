interface SegmentedControlOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  /** Tamano visual del control. Por defecto 'sm' (mismo tamano ya usado
   * hasta ahora) — no afecta value/onChange ni la logica de seleccion. */
  size?: 'sm' | 'md'
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'min-w-16 flex-1 px-2 py-1.5 text-xs leading-tight',
}

/**
 * components/ui/SegmentedControl.tsx
 * -----------------------------------------------------------------------------
 * Grupo de botones de seleccion unica, controlado (sin estado interno).
 * Generico: no conoce ningun tipo de dominio — el consumidor arma las
 * `options` y castea `value`/`onChange` al tipo que corresponda.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'sm',
}: SegmentedControlProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? `rounded-lg bg-brand text-center font-medium text-brand-foreground ${SIZE_CLASSES[size]}`
              : `rounded-lg border text-center font-medium text-muted-foreground hover:bg-muted/50 ${SIZE_CLASSES[size]}`
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}