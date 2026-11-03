import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { CheckCheck, ExternalLink, Inbox, RefreshCw, TriangleAlert } from 'lucide-react'
import { fetchNotifications, fetchUnreadCount, markAllRead, markRead } from '../../api/notification'
import type { NotificationItem, Role } from '../../api/types'
import { NOTIFICATION_LABEL } from '../../lib/labels'
import { formatDate, formatDateTime } from '../../lib/format'
import { useAuth } from '../../auth/AuthContext'
import { Badge, Button, EmptyState, Spinner } from '../../components/ui'

/** Hàng notifications đọc bằng JdbcTemplate.queryForList: mảng thô, không phân trang, không lọc chưa đọc. */
const POLL_INTERVAL_MS = 60_000

export default function NotificationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [onlyUnread, setOnlyUnread] = useState(false)

  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: fetchNotifications,
    refetchInterval: POLL_INTERVAL_MS,
  })
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchUnreadCount,
    refetchInterval: POLL_INTERVAL_MS,
  })

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
  }

  const readOne = useMutation({
    mutationFn: (id: number) => markRead(id),
    onSuccess: invalidateNotifications,
  })

  const readAll = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => {
      invalidateNotifications()
      toast.success('Đã đánh dấu toàn bộ thông báo là đã đọc.')
    },
  })

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data])
  const visible = useMemo(() => (onlyUnread ? items.filter((item) => item.read_at == null) : items), [items, onlyUnread])
  const groups = useMemo(() => groupByDay(visible), [visible])
  const unreadCount = unreadQuery.data ?? 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Thông báo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hoạt động liên quan tới hồ sơ, đơn ứng tuyển, lịch học và giấy tờ của bạn.
            {user != null && <span className="text-slate-400"> Đang xem với tài khoản {user.fullName} ({user.role === 'TUTOR' ? 'gia sư' : user.role === 'PARENT' ? 'phụ huynh' : 'quản trị'}).</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void listQuery.refetch()} loading={listQuery.isFetching}>
            <RefreshCw className="size-4" /> Tải lại
          </Button>
          <Button onClick={() => readAll.mutate()} loading={readAll.isPending} disabled={unreadCount === 0}>
            <CheckCheck className="size-4" /> Đánh dấu tất cả đã đọc
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone={unreadCount > 0 ? 'amber' : 'green'}>
          {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Không còn thông báo chưa đọc'}
        </Badge>
        <button
          type="button"
          onClick={() => setOnlyUnread((value) => !value)}
          aria-pressed={onlyUnread}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {onlyUnread ? 'Hiện bộ lọc chưa đọc' : 'Chỉ hiện thông báo chưa đọc'}
        </button>
        <span className="text-xs text-slate-500">
          Bộ lọc chạy trên trình duyệt: <code className="rounded bg-slate-100 px-1 py-0.5">GET /notifications</code> không nhận
          tham số lọc hay phân trang, nên trang này tải toàn bộ thông báo của bạn trong một lần gọi.
        </span>
      </div>

      {listQuery.isLoading && <Spinner />}

      {listQuery.isError && (
        <EmptyState>
          <p className="flex items-center justify-center gap-2">
            <TriangleAlert className="size-4" /> Không tải được thông báo. Hãy chắc chắn backend TutorHub đang chạy tại{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
          </p>
          <div className="mt-3 flex justify-center">
            <Button variant="secondary" onClick={() => void listQuery.refetch()}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
          </div>
        </EmptyState>
      )}

      {!listQuery.isLoading && !listQuery.isError && groups.length === 0 && (
        <EmptyState>
          <p className="flex items-center justify-center gap-2">
            <Inbox className="size-4" /> {onlyUnread ? 'Bạn đã đọc hết thông báo.' : 'Chưa có thông báo nào.'}
          </p>
          <p className="mt-1 text-xs">
            Thông báo được tạo khi có đơn ứng tuyển, khi lịch học đổi trạng thái hoặc khi hồ sơ/giấy tờ được duyệt.
          </p>
        </EmptyState>
      )}

      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
          {group.items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              viewerRole={user?.role}
              isPending={readOne.isPending && readOne.variables === item.id}
              onMarkRead={() => readOne.mutate(item.id)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function NotificationRow({
  item,
  viewerRole,
  isPending,
  onMarkRead,
}: {
  item: NotificationItem
  viewerRole: Role | undefined
  isPending: boolean
  onMarkRead: () => void
}) {
  const unread = item.read_at == null
  const href = hrefForNotification(item, viewerRole)
  const dataText = describeData(item.data)

  return (
    <article
      className={
        unread
          ? 'rounded-xl border border-brand-500 bg-brand-50 p-4 shadow-sm'
          : 'rounded-xl border border-slate-200 bg-white p-4'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {unread && <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
            <h3 className="text-sm font-semibold text-slate-900">{notificationLabel(item.type)}</h3>
            <Badge tone={unread ? 'blue' : 'slate'}>{unread ? 'Chưa đọc' : 'Đã đọc'}</Badge>
          </div>

          <p className="mt-1 text-sm text-slate-700">{item.title}</p>
          {item.body != null && <p className="mt-1 text-sm text-slate-600">{item.body}</p>}
          {dataText != null && (
            <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-600">{dataText}</p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            <span title={formatDateTime(item.created_at)}>{relativeTime(item.created_at)}</span>
            {item.read_at != null && <span> · đã đọc {relativeTime(item.read_at)}</span>}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {unread && (
            <Button variant="secondary" onClick={onMarkRead} loading={isPending}>
              Đánh dấu đã đọc
            </Button>
          )}
          {href != null && (
            <Link to={href} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              Mở liên quan <ExternalLink className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------- suy hướng đến

/**
 * Bảng notifications không có cột link/route, nên chỉ suy ra các đường dẫn chắc chắn tồn tại trong
 * App.tsx: data.requestId -> /requests/{id}, data.bookingId -> /bookings, còn lại theo type.
 */
function hrefForNotification(item: NotificationItem, viewerRole: Role | undefined): string | null {
  const data = readDataRecord(item.data)
  const requestId = numberField(data, 'requestId')
  if (requestId != null) return `/requests/${requestId}`

  const conversationId = numberField(data, 'conversationId')
  if (conversationId != null) return `/messages/${conversationId}`

  const bookingId = numberField(data, 'bookingId')
  if (bookingId != null) return '/bookings'

  const tutorId = numberField(data, 'tutorId')
  if (viewerRole === 'PARENT' && tutorId != null && item.type.startsWith('APPLICATION_')) return `/tutors/${tutorId}`
  if (viewerRole === 'TUTOR' && item.type.startsWith('APPLICATION_')) return '/applications/mine'
  if (item.type.startsWith('BOOKING_')) return '/bookings'
  if (item.type.startsWith('TUTOR_') || item.type.startsWith('DOCUMENT_')) return viewerRole === 'TUTOR' ? '/tutor' : null
  return null
}

// ---------------------------------------------------------------- cột data (jsonb)

/** Cột data là JSONB đọc qua JDBC nên có thể là chuỗi, object phẳng hoặc PGobject {type, value}. */
function readDataRecord(value: unknown): Record<string, unknown> {
  if (value == null) return {}
  if (typeof value === 'string') return parseJsonObject(value)
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const nested = record['value']
    if (typeof nested === 'string' && (record['type'] === 'jsonb' || record['type'] === 'json')) {
      return parseJsonObject(nested)
    }
    return record
  }
  return {}
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return {}
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const raw = record[key]
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

/** Hiển thị `data` một cách phòng thủ: không bao giả dạng kiểu, không ném lỗi khi stringify. */
function describeData(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? null : text
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const record = readDataRecord(value)
  if (Object.keys(record).length === 0) return null
  try {
    return JSON.stringify(record)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- nhãn & mốc thời gian

function notificationLabel(type: string): string {
  return NOTIFICATION_LABEL[type] ?? type
}

function relativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'thời gian không hợp lệ'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'vừa xong'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return formatDate(iso)
}

interface DayGroup {
  key: string
  label: string
  items: NotificationItem[]
}

/** Nhóm theo ngày địa phương; created_at đã được backend sắp giảm dần nên nhóm cũng ra đúng thứ tự. */
function groupByDay(items: NotificationItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const item of items) {
    const key = dayKey(item.created_at)
    const last = groups[groups.length - 1]
    if (last != null && last.key === key) last.items.push(item)
    else groups.push({ key, label: dayLabel(key, item.created_at), items: [item] })
  }
  return groups
}

function dayKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'invalid'
  return format(date, 'yyyy-MM-dd')
}

function dayLabel(key: string, iso: string): string {
  if (key === 'invalid') return 'Không rõ ngày'
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd')
  if (key === today) return `Hôm nay · ${formatDate(iso)}`
  if (key === yesterday) return `Hôm qua · ${formatDate(iso)}`
  return formatDate(iso)
}
