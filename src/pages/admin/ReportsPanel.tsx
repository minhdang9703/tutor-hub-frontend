import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle2, ExternalLink, EyeOff, RefreshCw, Search } from 'lucide-react'
import { fetchReports, hideReview, resolveReport } from '../../api/admin'
import { ApiClientError } from '../../api/client'
import type { AdminReport } from '../../api/types'
import { REPORT_TARGET_LABEL } from '../../lib/labels'
import { formatDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, PageNav, Select, Spinner, Textarea } from '../../components/ui'
import { ADMIN_PAGE_SIZE, RESOLUTION_MAX, notifyQueryError, toneFor, userRefLabel } from './adminLabels'

/** reports.status có CHECK('OPEN','RESOLVED','DISMISSED') trong schema, nhưng backend chỉ ghi OPEN rồi RESOLVED. */
const REPORT_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Chưa xử lý',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Đã bỏ qua',
}

const STATUS_OPTIONS = Object.keys(REPORT_STATUS_LABEL)

export default function ReportsPanel() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [resolution, setResolution] = useState('')
  const [resolutionError, setResolutionError] = useState<string | null>(null)
  const [hidingId, setHidingId] = useState<number | null>(null)

  const reportsQuery = useQuery({
    queryKey: ['admin', 'reports', page],
    queryFn: () => fetchReports(page, ADMIN_PAGE_SIZE),
  })

  function invalidateLists() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
  }

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution: text }: { id: number; resolution: string }) => resolveReport(id, text),
    onSuccess: () => {
      invalidateLists()
      setResolvingId(null)
      setResolution('')
      setResolutionError(null)
      toast.success('Đã đánh dấu báo cáo là xử lý xong.')
    },
  })

  const hideMutation = useMutation({
    mutationFn: (reviewId: number) => hideReview(reviewId),
    onSuccess: () => {
      invalidateLists()
      setHidingId(null)
      toast.success('Đã ẩn đánh giá khỏi điểm trung bình của gia sư.')
    },
  })

  const data = reportsQuery.data
  const rows = useMemo(() => data?.content ?? [], [data])
  const filtered = useMemo(
    () => (statusFilter ? rows.filter((row) => row.status === statusFilter) : rows),
    [rows, statusFilter],
  )

  function startResolve(report: AdminReport) {
    setResolvingId(report.id)
    setResolution('')
    setResolutionError(null)
    setHidingId(null)
  }

  function submitResolve(report: AdminReport) {
    const trimmed = resolution.trim()
    if (!trimmed) {
      setResolutionError('Nội dung kết luận là bắt buộc (backend: @NotBlank).')
      return
    }
    if (trimmed.length > RESOLUTION_MAX) {
      setResolutionError(`Tối đa ${RESOLUTION_MAX} ký tự (hiện đang ${trimmed.length}).`)
      return
    }
    setResolutionError(null)
    resolveMutation.mutate({ id: report.id, resolution: trimmed })
  }

  return (
    <div className="space-y-6">
      <Card title="Báo cáo từ cộng đồng">
        {reportsQuery.isLoading && <Spinner />}
        {reportsQuery.isError && (
          <EmptyState>
            <p className="mb-1 font-medium text-slate-700">
              {reportsQuery.error instanceof ApiClientError && reportsQuery.error.status === 403
                ? 'Bạn không có vai trò ADMIN nên /admin/reports trả 403.'
                : 'Không tải được danh sách báo cáo.'}
            </p>
            <p className="mb-3">
              Kiểm tra backend đang chạy tại{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
            </p>
            <Button variant="secondary" onClick={() => void reportsQuery.refetch().then(notifyQueryError)}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
          </EmptyState>
        )}

        {!reportsQuery.isLoading && !reportsQuery.isError && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Select
                label="Trạng thái"
                className="w-64"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                hint="Bộ lọc chỉ áp dụng trên trang đang xem vì /admin/reports không nhận tham số lọc."
              >
                <option value="">Mọi trạng thái</option>
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {REPORT_STATUS_LABEL[value]}
                  </option>
                ))}
              </Select>
              {reportsQuery.data && (
                <p className="text-sm text-slate-500">
                  {reportsQuery.data.totalElements} báo cáo toàn hệ thống · {filtered.length}/{rows.length} dòng trên trang này
                </p>
              )}
            </div>

            {rows.length === 0 ? (
              <EmptyState>
                <p className="mb-1 font-medium text-slate-700">Chưa có báo cáo nào.</p>
                <p>Phụ huynh và gia sư gửi báo cáo từ trang hồ sơ gia sư, đánh giá và hội thoại.</p>
              </EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState>Trang này không có báo cáo nào khớp bộ lọc trạng thái.</EmptyState>
            ) : (
              <ul className="space-y-4">
                {filtered.map((report) => (
                  <li key={report.id}>
                    <ReportCard
                      report={report}
                      resolving={resolvingId === report.id}
                      resolveBusy={resolveMutation.isPending && resolveMutation.variables?.id === report.id}
                      resolution={resolution}
                      resolutionError={resolutionError}
                      onResolutionChange={(value) => setResolution(value)}
                      onAskResolve={() => startResolve(report)}
                      onResolve={() => submitResolve(report)}
                      onCancelResolve={() => setResolvingId(null)}
                      hiding={hidingId === report.id}
                      hideBusy={hideMutation.isPending && hideMutation.variables === report.id}
                      onAskHide={() => {
                        setHidingId(report.id)
                        setResolvingId(null)
                      }}
                      onCancelHide={() => setHidingId(null)}
                      onConfirmHide={() => hideMutation.mutate(report.targetId)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {reportsQuery.data && (
              <PageNav page={reportsQuery.data.page} totalPages={reportsQuery.data.totalPages} onChange={setPage} />
            )}
          </div>
        )}
      </Card>

      <Card title="Giới hạn hiện tại">
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-slate-400" />
            Ẩn đánh giá chỉ áp dụng cho đánh giá đang hiển thị; backend tính lại rating_avg/rating_count của gia sư và không
            có endpoint bỏ ẩn.
          </li>
          <li className="flex gap-2">
            <Search className="mt-0.5 size-4 shrink-0 text-slate-400" />
            Với báo cáo nhắm vào buổi học hoặc tin nhắn, backend không có endpoint chi tiết cho admin nên console chỉ thấy
            id đích; phải đối chiếu trong khu vực gia sư/phụ huynh.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-slate-400" />
            Chưa xử lý chỉ chuyển được sang Đã xử lý (POST /admin/reports/{'{id}'}/resolve); schema cho phép DISMISSED
            nhưng chưa endpoint nào ghi trạng thái đó.
          </li>
        </ul>
      </Card>
    </div>
  )
}

interface ReportCardProps {
  report: AdminReport
  resolving: boolean
  resolveBusy: boolean
  resolution: string
  resolutionError: string | null
  onResolutionChange: (value: string) => void
  onAskResolve: () => void
  onResolve: () => void
  onCancelResolve: () => void
  hiding: boolean
  hideBusy: boolean
  onAskHide: () => void
  onCancelHide: () => void
  onConfirmHide: () => void
}

function ReportCard({
  report,
  resolving,
  resolveBusy,
  resolution,
  resolutionError,
  onResolutionChange,
  onAskResolve,
  onResolve,
  onCancelResolve,
  hiding,
  hideBusy,
  onAskHide,
  onCancelHide,
  onConfirmHide,
}: ReportCardProps) {
  const targetLabel = REPORT_TARGET_LABEL[report.targetType] ?? report.targetType
  const open = report.status === 'OPEN'

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">Báo cáo #{report.id}</span>
        <Badge tone={toneFor(report.status)}>{REPORT_STATUS_LABEL[report.status] ?? report.status}</Badge>
        <Badge tone="slate">
          {targetLabel} #{report.targetId}
        </Badge>
        <span className="ml-auto text-xs text-slate-400">{formatDateTime(report.createdAt)}</span>
      </header>

      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Lý do báo cáo</dt>
          <dd className="font-medium text-slate-800">{report.reason}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Người gửi</dt>
          <dd className="font-medium text-slate-800">{userRefLabel(report.reporterId)}</dd>
        </div>
        {report.description && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Mô tả thêm</dt>
            <dd className="mt-0.5 whitespace-pre-line text-slate-600">{report.description}</dd>
          </div>
        )}
        {report.resolution && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Kết luận xử lý</dt>
            <dd className="mt-0.5 whitespace-pre-line text-slate-600">{report.resolution}</dd>
            <dd className="mt-1 text-xs text-slate-400">
              {userRefLabel(report.resolvedBy)}
              {report.resolvedAt ? ` · ${formatDateTime(report.resolvedAt)}` : ''}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {open && (
          <Button variant="secondary" className="px-3 py-1.5" disabled={resolveBusy} onClick={onAskResolve}>
            <CheckCircle2 className="size-4" /> Xử lý báo cáo
          </Button>
        )}
        {open && report.targetType === 'REVIEW' && (
          <Button variant="ghost" className="px-3 py-1.5 text-red-600 hover:bg-red-50" disabled={hideBusy} onClick={onAskHide}>
            <EyeOff className="size-4" /> Ẩn đánh giá #{report.targetId}
          </Button>
        )}
        {report.targetType === 'USER' && (
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="size-4" /> Mở mục Người dùng
          </Link>
        )}
      </div>

      {open && resolving && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <Textarea
            label="Kết luận xử lý (bắt buộc, lưu vào báo cáo)"
            value={resolution}
            maxLength={RESOLUTION_MAX}
            onChange={(event) => onResolutionChange(event.target.value)}
            hint={resolutionError ?? `Tối đa ${RESOLUTION_MAX} ký tự · hiện ${resolution.trim().length}/${RESOLUTION_MAX}`}
            className={resolutionError ? 'border-red-400' : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="px-3 py-1.5" disabled={resolveBusy} onClick={onCancelResolve}>
              Hủy
            </Button>
            <Button loading={resolveBusy} disabled={!resolution.trim()} onClick={onResolve}>
              <CheckCircle2 className="size-4" /> Xác nhận đã xử lý
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Backend chỉ cập nhật báo cáo còn OPEN; nếu một admin khác vừa xử lý, request sẽ trả NOT_FOUND “Open report not
            found”.
          </p>
        </div>
      )}

      {hiding && (
        <div className="mt-3 rounded-lg bg-red-50 p-3">
          <p className="mb-2 text-sm text-red-700">
            Ẩn đánh giá #{report.targetId}? Đánh giá biến mất khỏi danh sách công khai và điểm của gia sư được tính lại.
            Không có API để bỏ ẩn.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1.5" onClick={onCancelHide}>
              Không
            </Button>
            <Button variant="danger" className="px-3 py-1.5" loading={hideBusy} onClick={onConfirmHide}>
              <EyeOff className="size-4" /> Ẩn đánh giá
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}
