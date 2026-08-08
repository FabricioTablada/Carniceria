import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { notificationsApi } from '../api/notifications.api'
import type { NotificationItem } from '../types/notification.types'

// A diferencia del resto de queries (staleTime de 5min por defecto, sin
// refetch automatico — ver lib/query/queryClient.ts), el Centro de
// Notificaciones refleja alertas operativas que cambian con el uso normal
// del sistema (una venta deja stock negativo, una caja lleva horas
// abierta): se sobreescribe staleTime a 1 minuto y se agrega un
// refetchInterval del mismo valor para mantenerlas razonablemente al dia
// sin sondear el backend en cada segundo.
const NOTIFICATIONS_REFRESH_INTERVAL_MS = 60 * 1000

/**
 * QA-006B: ids de notificaciones `critical` ya mostradas como toast, y si
 * ya se establecio la "foto" inicial. A nivel de modulo (no de estado de
 * React) a proposito: `NotificationBell.tsx` es el unico consumidor de
 * este hook, pero se desmonta/remonta al cambiar de layout (Sidebar <->
 * PosHeader, ver `NotificationBell.tsx`) — un `useState`/`useRef` local se
 * reiniciaria en cada cambio de pantalla y volveria a mostrar el mismo
 * toast. Vivir a nivel de modulo hace que "una vez por alerta mientras la
 * aplicacion permanezca abierta" sea literal: solo se reinicia con una
 * recarga completa de pagina.
 *
 * `hasEstablishedBaseline`: la PRIMERA vez que llegan datos (recien
 * logueado, o recien recargada la pagina) se registran los `critical` ya
 * existentes SIN mostrar toast — no son "nuevas", son las que ya estaban
 * ahi antes de que el usuario abriera la sesion. Sin este paso, cada login
 * dispararia un toast por cada alerta critica preexistente, exactamente el
 * ruido que el resto de este trabajo (QA-006A) busca reducir. Los pollings
 * siguientes (cada 60s) si disparan un toast por cada `critical` que no
 * estuviera ya en `seenCriticalIds`.
 */
const seenCriticalIds = new Set<string>()
let hasEstablishedBaseline = false

export function useNotifications() {
  // QA Final 1.0 (Bloque 6): `GET /notifications` exige `reports.view` en
  // el backend (`notifications.routes.ts`) — sin este guard, cualquier
  // usuario sin ese permiso (p.ej. un Cajero cuyo rol no lo incluye)
  // generaba un 403 evitable en cada carga de pantalla, ya que
  // `NotificationBell.tsx` esta siempre montado en el header. Mismo
  // criterio ya aplicado en `getDefaultRoute`/`navigation.ts` para el
  // mismo problema en el Dashboard.
  const { hasPermission } = usePermissions()
  const canViewNotifications = hasPermission(PERMISSIONS.REPORTS_VIEW)

  const query = useQuery<NotificationItem[], AxiosError>({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.getNotifications(),
    staleTime: NOTIFICATIONS_REFRESH_INTERVAL_MS,
    refetchInterval: NOTIFICATIONS_REFRESH_INTERVAL_MS,
    enabled: canViewNotifications,
  })

  const { data } = query

  useEffect(() => {
    if (!data) {
      return
    }

    const criticalItems = data.filter((item) => item.severity === 'critical')

    if (!hasEstablishedBaseline) {
      hasEstablishedBaseline = true
      criticalItems.forEach((item) => seenCriticalIds.add(item.id))
      return
    }

    for (const item of criticalItems) {
      if (seenCriticalIds.has(item.id)) {
        continue
      }

      seenCriticalIds.add(item.id)
      toast.error(item.title, { description: item.message })
    }
  }, [data])

  return query
}
