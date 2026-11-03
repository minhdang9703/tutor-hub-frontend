import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Ban, Check, RefreshCw, ShieldAlert, Users } from 'lucide-react'
import { activateUser, fetchUsers, suspendUser } from '../../api/admin'
import { ApiClientError } from '../../api/client'
import type { AdminUser, Role, UserStatus } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABEL, USER_STATUS_LABEL } from '../../lib/labels'
import { formatDate } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Input, PageNav, Select, Spinner } from '../../components/ui'
import { ADMIN_PAGE_SIZE, notifyQueryError, toneFor } from './adminLabels'

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const STATUSES = Object.keys(USER_STATUS_LABEL) as UserStatus[]

interface PendingAction {
  id: number
  name: string
  action: 'suspend' | 'activate'
}

export default function UsersPanel() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [term, setTerm] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [confirm, setConfirm] = useState<PendingAction | null>(null)

  // Dùng id của chính admin đang đăng nhập để chặn thao tác tự khóa.
  const { user } = useAuth()

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => fetchUsers(page, ADMIN_PAGE_SIZE),
  })

  const statusMutation = useMutation({
    mutationFn: (target: PendingAction) => (target.action === 'suspend' ? suspendUser(target.id) : activateUser(target.id)),
    onSuccess: (_result, target) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setConfirm(null)
      toast.success(target.action === 'suspend' ? `Đã tạm khóa ${target.name}.` : `Đã kích hoạt lại ${target.name}.`)
    },
  })

  const data = usersQuery.data
  const rows = useMemo(() => data?.content ?? [], [data])
  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (role && row.role !== role) return false
      if (status && row.status !== status) return false
      if (!needle) return true
      return (
        row.fullName.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        (row.phone ?? '').toLowerCase().includes(needle) ||
        String(row.id) === needle
      )
    })
  }, [rows, term, role, status])

  return (
    <div className="space-y-6">
      <Card title="Người dùng">
        {usersQuery.isLoading && <Spinner />}
        {usersQuery.isError && (
          <EmptyState>
            <p className="mb-1 font-medium text-slate-700">
              {usersQuery.error instanceof ApiClientError && usersQuery.error.status === 403
                ? 'Bạn không có vai trò ADMIN nên /admin/users trả 403.'
                : 'Không tải được danh sách người dùng.'}
            </p>
            <p className="mb-3">
              Kiểm tra backend đang chạy tại{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
            </p>
            <Button variant="secondary" onClick={() => void usersQuery.refetch().then(notifyQueryError)}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
          </EmptyState>
        )}

        {!usersQuery.isLoading && !usersQuery.isError && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Tìm theo tên, email, số điện thoại hoặc id"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="vd: nguyenvana hoặc 12"
              />
              <Select label="Vai trò" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">Mọi vai trò</option>
                {ROLES.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABEL[value]}
                  </option>
                ))}
              </Select>
              <Select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Mọi trạng thái</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {USER_STATUS_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>

            <p className="text-xs text-slate-500">
              Bộ lọc chạy trên máy và chỉ áp dụng cho trang đang xem: GET /admin/users không nhận tham số tìm kiếm/lọc nào
              ngoài page và size.
            </p>

            {rows.length === 0 ? (
              <EmptyState>
                <p className="mb-1 font-medium text-slate-700">Chưa có người dùng nào trong hệ thống.</p>
                <p>Admin khởi tạo qua biến môi trường ADMIN_EMAIL/ADMIN_PASSWORD khi backend bật lên.</p>
              </EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState>Trang này không có dòng nào khớp bộ lọc. Thử đổi bộ lọc hoặc sang trang khác.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-medium">Người dùng</th>
                      <th className="py-2 pr-3 font-medium">Vai trò</th>
                      <th className="py-2 pr-3 font-medium">Trạng thái</th>
                      <th className="py-2 pr-3 font-medium">Từ ngày</th>
                      <th className="py-2 font-medium">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <UserRow
                        key={row.id}
                        row={row}
                        isSelf={row.id === user?.id}
                        busy={statusMutation.isPending}
                        confirming={confirm?.id === row.id}
                        onAsk={(action) => setConfirm({ id: row.id, name: row.fullName, action })}
                        onCancel={() => setConfirm(null)}
                        onConfirm={() => confirm && statusMutation.mutate(confirm)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-slate-500">
              {usersQuery.data
                ? `Hiển thị ${filtered.length}/${usersQuery.data.content.length} dòng của trang · ${usersQuery.data.totalElements} tài khoản toàn hệ thống`
                : ''}
            </p>
            {usersQuery.data && (
              <PageNav page={usersQuery.data.page} totalPages={usersQuery.data.totalPages} onChange={setPage} />
            )}
          </div>
        )}
      </Card>

      <Card title="Tạm khóa tài khoản hoạt động thế nào?">
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span>
              <strong className="font-medium text-slate-800">Phiên đang đăng nhập không bị thu hồi ngay.</strong>{' '}
              AdminService.setUserStatus chỉ đổi cột <code className="rounded bg-slate-100 px-1 text-xs">users.status</code>{' '}
              và ghi nhật ký; nó không revoke refresh token. JwtAuthenticationFilter lại chỉ đọc role từ token chứ không
              kiểm tra trạng thái, nên access token đã cấp vẫn gọi được API cho tới khi hết hạn (mặc định 15 phút —{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">JWT_ACCESS_MINUTES</code>).
            </span>
          </li>
          <li className="flex gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <span>
              Sau khi token hết hạn, người dùng bị chặn hoàn toàn: /auth/login từ chối tài khoản SUSPENDED (403 “Account
              is suspended”) và /auth/refresh yêu cầu trạng thái ACTIVE.
            </span>
          </li>
          <li className="flex gap-2">
            <Ban className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <span>
              Backend không có endpoint xóa tài khoản cho admin (không có DELETE /admin/users/{'{id}'}) nên trạng thái
              DELETED không thể đặt từ console này; chỉ Tạm khóa và Kích hoạt.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  )
}

function UserRow({
  row,
  isSelf,
  busy,
  confirming,
  onAsk,
  onCancel,
  onConfirm,
}: {
  row: AdminUser
  isSelf: boolean
  busy: boolean
  confirming: boolean
  onAsk: (action: 'suspend' | 'activate') => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const suspended = row.status === 'SUSPENDED'

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-3 pr-3">
        <p className="font-medium text-slate-800">
          {row.fullName} <span className="ml-1 text-xs text-slate-400">#{row.id}</span>
        </p>
        <p className="text-xs text-slate-500">{row.email}</p>
        <p className="text-xs text-slate-400">{row.phone || 'Không có số điện thoại'}</p>
      </td>
      <td className="py-3 pr-3">
        <Badge tone={row.role === 'ADMIN' ? 'blue' : 'slate'}>{ROLE_LABEL[row.role]}</Badge>
      </td>
      <td className="py-3 pr-3">
        <Badge tone={toneFor(row.status)}>{USER_STATUS_LABEL[row.status]}</Badge>
      </td>
      <td className="py-3 pr-3 whitespace-nowrap text-xs text-slate-500">{formatDate(row.createdAt)}</td>
      <td className="py-3">
        <div className="flex flex-col gap-2">
          {suspended ? (
            <Button variant="secondary" className="px-3 py-1.5" disabled={busy || isSelf} onClick={() => onAsk('activate')}>
              <Check className="size-4" /> Kích hoạt
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-red-600 hover:bg-red-50"
              disabled={busy || isSelf || row.status === 'DELETED'}
              onClick={() => onAsk('suspend')}
            >
              <Ban className="size-4" /> Tạm khóa
            </Button>
          )}
          {isSelf && <span className="text-xs text-slate-400">Không thể tự khóa tài khoản của bạn</span>}
          {confirming && (
            <div className="rounded-lg bg-red-50 px-3 py-2">
              <p className="mb-2 text-xs text-red-700">
                {suspended
                  ? `Kích hoạt lại ${row.fullName} (#${row.id})? Người dùng sẽ đăng nhập và làm mới token được bình thường.`
                  : `Tạm khóa ${row.fullName} (#${row.id})? Token đã cấp vẫn còn hiệu lực tới khi hết hạn.`}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="px-3 py-1.5" onClick={onCancel}>
                  Không
                </Button>
                <Button
                  variant={suspended ? 'primary' : 'danger'}
                  className="px-3 py-1.5"
                  loading={busy}
                  onClick={onConfirm}
                >
                  {suspended ? 'Kích hoạt' : 'Tạm khóa'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
