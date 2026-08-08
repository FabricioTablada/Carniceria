import { Badge } from '@/components/common/Badge'

/**
 * features/settings/components/AlegraStatusBadge.tsx
 * -----------------------------------------------------------------------------
 * Mismo patrón "wrapper de módulo delega en `Badge`" que
 * `components/common/ActiveStatusBadge.tsx` — no se extiende ese
 * componente porque "Conectado"/"Sin configurar" es semántica propia de
 * esta pantalla, no un estado activo/inactivo genérico.
 *
 * "Conectado" refleja únicamente que hay credenciales guardadas
 * (`AlegraConfigStatus.configured`) — ver Bloque 7.4, punto 7: esta
 * insignia nunca dispara una llamada real a Alegra, solo lee el estado ya
 * cargado por `useAlegraConfigStatus`.
 */
interface AlegraStatusBadgeProps {
  configured: boolean
}

export function AlegraStatusBadge({ configured }: AlegraStatusBadgeProps) {
  return (
    <Badge
      variant={configured ? 'secondary' : 'muted'}
      className="justify-center gap-1.5 py-1"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {configured ? 'Conectado' : 'Sin configurar'}
    </Badge>
  )
}
