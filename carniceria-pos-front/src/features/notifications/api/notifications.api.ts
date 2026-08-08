import { httpClient } from '@/lib/htpp/client'
import type { NotificationItem } from '../types/notification.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const notificationsApi = {
  getNotifications: async (): Promise<NotificationItem[]> => {
    const { data } = await httpClient.get<ApiEnvelope<NotificationItem[]>>(
      '/notifications',
    )

    return data.data
  },
}
