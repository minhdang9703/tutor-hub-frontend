import type { ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Flag, Inbox, ScrollText, Search, UserCheck, Users } from 'lucide-react'
import { fetchPendingTutors, fetchStats } from '../../api/admin'
import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui'
import { ADMIN_PAGE_SIZE, formatCount, notifyQueryError } from './adminLabels'

interface StatCard {
  label: string
  value: number | undefined
  hint: string
  icon: ComponentType<{ className?: string }>
  /** Đường dẫn tuyệt đối tới tab admin; trang tổng quan chỉ render tại /admin nên link luôn giải đúng. */
  to?: string
  toLabel?: string
  tone?: 'green' | 'blue' | 'amber' | 'red' | 'slate'
}

export default function AdminDashboard() {
  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchStats })
  // Hàng đợi chờ duyệt không có trong /admin/stats (chỉ đếm gia sư VERIFIED) — lấy totalElements của chính hàng đợi.
  const queueQuery = useQuery({
    queryKey: ['admin', 'tutors', 'queue'],
    queryFn: () => fetchPendingTutors(0, 1),
  })

  const stats = statsQuery.data

  const cards: StatCard[] = [
    {
      label: 'Người dùng',
      value: stats?.users,
      hint: 'Toàn bộ tài khoản, kể cả tạm khóa hoặc đã xóa.',
      icon: Users,
      to: '/admin/users',
      toLabel: 'Quản lý người dùng',
    },
    {
      label: 'Gia sư đã xác minh',
      value: stats?.activeTutors,
      hint: 'Hồ sơ ở trạng thái VERIFIED — đang hiện thị cho phụ huynh.',
      icon: UserCheck,
      tone: 'green',
    },
    {
      label: 'Hồ sơ chờ duyệt',
      value: queueQuery.data?.totalElements,
      hint: 'Đếm từ hàng đợi /admin/tutors (verification_status = PENDING).',
      icon: Inbox,
      to: '/admin/tutors',
      toLabel: 'Vào hàng đợi duyệt',
      tone: 'amber',
    },
    {
      label: 'Yêu cầu tìm gia sư đang mở',
      value: stats?.openRequests,
      hint: 'Bảng tutor_requests với status = OPEN.',
      icon: Search,
    },
    {
      label: 'Buổi học chờ xác nhận',
      value: stats?.pendingBookings,
      hint: 'Bookings status = PENDING.',
      icon: CalendarDays,
    },
    {
      label: 'Buổi học hoàn thành',
      value: stats?.completedBookings,
      hint: 'Bookings status = COMPLETED.',
      icon: CalendarDays,
      tone: 'green',
    },
    {
      label: 'Báo cáo còn mở',
      value: stats?.openReports,
      hint: 'Reports status = OPEN — cần bạn xử lý.',
      icon: Flag,
      to: '/admin/reports',
      toLabel: 'Mở mục Báo cáo',
      tone: 'red',
    },
  ]

  return (
    <div className="space-y-6">
      <Card title="Chỉ số hệ thống">
        {statsQuery.isLoading && <Spinner />}
        {statsQuery.isError && (
          <EmptyState>
            <p className="mb-1 font-medium text-slate-700">
              Không tải được thống kê. Tài khoản của bạn phải có vai trò ADMIN để gọi /admin/*.
            </p>
            <p className="mb-3">
              Kiểm tra backend đang chạy tại{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
            </p>
            <Button variant="secondary" onClick={() => void statsQuery.refetch().then(notifyQueryError)}>
              Thử lại
            </Button>
          </EmptyState>
        )}
        {!statsQuery.isError && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ label, value, hint, icon: Icon, to, toLabel, tone }) => (
              <li key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Icon className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {value == null ? <span className="text-slate-300">—</span> : formatCount(value)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{hint}</p>
                {to && toLabel && (
                  <Link to={to} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                    {toLabel} <ArrowRight className="size-3.5" />
                  </Link>
                )}
                {tone && value != null && value > 0 && (
                  <span className="mt-2 block">
                    <Badge tone={tone}>
                      {tone === 'red' ? 'Cần xử lý' : tone === 'amber' ? 'Đang chờ' : 'Đang hoạt động'}
                    </Badge>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Giới hạn của khu vực quản trị">
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <Inbox className="mt-0.5 size-4 shrink-0 text-slate-400" />
            Backend không có endpoint liệt kê yêu cầu tìm gia sư hay lịch học cho admin, nên hai chỉ số trên chỉ để tham khảo —
            chưa bấm vào để xem danh sách được.
          </li>
          <li className="flex gap-2">
            <ScrollText className="mt-0.5 size-4 shrink-0 text-slate-400" />
            Mọi hành động bạn thực hiện ở đây đều được ghi vào mục{' '}
            <Link to="/admin/audit" className="font-medium text-brand-600 hover:underline">
              Nhật ký
            </Link>
            .
          </li>
          <li className="flex gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-slate-400" />
            Danh sách người dùng và báo cáo chỉ phân trang theo trang ({ADMIN_PAGE_SIZE} dòng); backend không nhận tham số
            tìm kiếm nên bộ lọc chỉ áp dụng trên trang đang xem.
          </li>
        </ul>
      </Card>
    </div>
  )
}
