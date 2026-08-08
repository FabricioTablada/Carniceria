interface LoadingStateProps {
  message: string
}

/**
 * components/ui/LoadingState.tsx
 * -----------------------------------------------------------------------------
 * Unifica el bloque de "cargando" que hoy esta duplicado, con el mismo
 * `<p className="text-sm text-muted-foreground">`, en 33 archivos del
 * proyecto — solo cambia el texto (`message`), ya resuelto por quien lo usa,
 * igual que ya se aplico en `ErrorAlert.tsx`.
 */
export function LoadingState({ message }: LoadingStateProps) {
  return <p className="text-sm text-muted-foreground">{message}</p>
}