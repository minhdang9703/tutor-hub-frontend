import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Bell, CheckCheck, MailOpen } from 'lucide-react'
import { fetchNotifications, fetchUnreadCount, markAllRead, markRead } from '../api/notification'
import { NOTIFICATION_LABEL } from '../lib/labels'
import { formatDate } from '../lib/format'
import { useAuth } from '../auth/AuthContext'

/** Danh sách thả nổi chỉ cần vài mục; trang /notifications dùng chung cùng một cache. */
const PREVIEW_LIMIT = 8

/** Backend không có websocket/push nên danh sách và số chưa đọc được quay lại mỗi 60 giây. */
const POLL_INTERVAL_MS = 60_000

export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Ghi lại route lúc mở nên đổi trang là dropdown tự đóng, không cần effect gọi setState.
  const [openOnPath, setOpenOnPath] = useState<string | null>(null)
  const open = openOnPath != null && openOnPath === location.pathname

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchUnreadCount,
    enabled: user != null,
    refetchInterval: POLL_INTERVAL_MS,
  })

  // Chỉ gọi GET /notifications (mảng thô, không phân trang) khi người dùng thực sự mở dropdown.
  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: fetchNotifications,
    enabled: user != null && open,
    refetchInterval: POLL_INTERVAL_MS,
  })

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
  }

  const readAll = useMutation({ mutationFn: () => markAllRead(), onSuccess: invalidateNotifications })
  const readOne = useMutation({ mutationFn: (id: number) => markRead(id), onSuccess: invalidateNotifications })

  const count = unreadQuery.data ?? 0
  const preview = useMemo(() => (listQuery.data ?? []).slice(0, PREVIEW_LIMIT), [listQuery.data])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      if (container != null && !container.contains(event.target as Node)) setOpenOnPath(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenOnPath(null)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (user == null) return null

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const next = !open
          setOpenOnPath(next ? location.pathname : null)
          if (next) queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="notification-bell-panel"
        aria-label={count > 0 ? `Thông báo, ${count} tin chưa đọc` : 'Thông báo'}
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-slate-600 transition hover:bg-slate-100"
      >
        <span className="relative">
          <Bell className="size-5" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white"
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          id="notification-bell-panel"
          role="region"
          aria-label="Thông báo gần đây"
          className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Thông báo gần đây</h2>
            <span className="text-xs text-slate-500">{count > 0 ? `${count} chưa đọc` : 'Đã đọc hết'}</span>
          </header>

          <div className="max-h-80 overflow-y-auto">
            {listQuery.isLoading && <p className="px-4 py-6 text-center text-sm text-slate-500">Đang tải…</p>}

            {listQuery.isError && (
              <p className="px-4 py-6 text-center text-sm text-red-600">
                Không đọc được thông báo. Mở trang thông báo để thử lại.
              </p>
            )}

            {!listQuery.isLoading && !listQuery.isError && preview.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có thông báo nào.</p>
            )}

            <ul className="divide-y divide-slate-100">
              {preview.map((item) => (
                <li key={item.id} className={clsx('flex items-start gap-2 px-4 py-3', item.read_at == null && 'bg-brand-50')}>
                  <span
                    aria-hidden="true"
                    className={clsx('mt-1.5 size-2 shrink-0 rounded-full', item.read_at == null ? 'bg-brand-600' : 'bg-slate-200')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{NOTIFICATION_LABEL[item.type] ?? item.type}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{previewTime(item.created_at)}</p>
                  </div>
                  {item.read_at == null && (
                    <button
                      type="button"
                      onClick={() => readOne.mutate(item.id)}
                      aria-label={`Đánh dấu thông báo ${item.id} là đã đọc`}
                      title="Đánh dấu đã đọc"
                      className="shrink-0 rounded p-1 text-slate-400 transition hover:text-brand-600"
                    >
                      <MailOpen className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={() => readAll.mutate()}
              disabled={count === 0 || readAll.isPending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck className="size-4" /> Đánh dấu tất cả đã đọc
            </button>
            <Link to="/notifications" className="text-sm font-medium text-brand-600 hover:underline">
              Xem tất cả
            </Link>
          </footer>
        </div>
      )}
    </div>
  )
}

/** Bản rút gọn của relative time cho dropdown; hàng notification dùng khóa snake_case. */
function previewTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'không rõ thời gian'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'vừa xong'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return formatDate(iso)
}
