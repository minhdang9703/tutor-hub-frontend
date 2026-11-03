import { http } from './client'
import type { NotificationItem } from './types'

/** Mảng thô không phân trang; khóa JSON ở đây là snake_case (read_at, created_at). */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await http.get<NotificationItem[]>('/notifications')
  return data
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await http.get<{ count: number }>('/notifications/unread-count')
  return data.count
}

export async function markRead(id: number): Promise<void> {
  await http.post(`/notifications/${id}/read`)
}

export async function markAllRead(): Promise<void> {
  await http.post('/notifications/read-all')
}
