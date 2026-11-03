import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ShieldAlert, Undo2 } from 'lucide-react'
import { ApiClientError } from '../../api/client'
import type { Application } from '../../api/types'
import { APPLICATION_STATUS_LABEL, STATUS_TONE } from '../../lib/labels'
import { formatDateTime, formatVnd } from '../../lib/format'
import { Badge, Button, Card, EmptyState, PageNav, Spinner } from '../../components/ui'
import {
  APPLICATION_ACTION_LABEL,
  REQUEST_PAGE_SIZE,
  describeRequestError,
  linkButtonClass,
  ownApplicationQueryOptions,
  useApplicationActionMutation,
  useMyTutorProfile,
} from './requestLogic'

export default function MyApplicationsPage() {
  const [page, setPage] = useState(0)
  const [withdrawTarget, setWithdrawTarget] = useState<number | null>(null)

  const tutorProfile = useMyTutorProfile(true)
  const actionMutation = useApplicationActionMutation()

  // GET /applications/mine đòi gia sư VERIFIED, nên chỉ gọi khi hồ sơ đã xác minh.
  const applicationsQuery = useQuery({
    ...ownApplicationQueryOptions(page, REQUEST_PAGE_SIZE),
    enabled: tutorProfile.canAct,
  })

  if (tutorProfile.isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Đơn ứng tuyển của tôi</h1>
        <Spinner />
      </div>
    )
  }

  if (!tutorProfile.canAct) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Đơn ứng tuyển của tôi</h1>
        <Card title="Cần xác minh hồ sơ">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {tutorProfile.profile == null
                ? 'Chưa đọc được hồ sơ gia sư của bạn (GET /tutors/me).'
                : 'Hồ sơ chưa được duyệt, nên backend chặn danh sách đơn ứng tuyển.'}{' '}
              Hoàn thiện và gửi hồ sơ để được xác minh, sau đó đơn của bạn sẽ hiện tại đây.
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/tutor" className={linkButtonClass}>
              Mở hồ sơ gia sư
            </Link>
            {tutorProfile.profile == null && (
              <Button variant="secondary" onClick={() => void tutorProfile.refetch()}>
                <RefreshCw className="size-4" /> Thử lại
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  const pageData = applicationsQuery.data
  const list = pageData?.content ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Đơn ứng tuyển của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Rút đơn khi còn PENDING. Sau khi phụ huynh chọn gia sư khác, đơn tự chuyển sang REJECTED.
          </p>
        </div>
        <Link to="/requests" className={linkButtonClass}>
          <ArrowLeft className="size-4" /> Yêu cầu đang mở
        </Link>
      </header>

      {applicationsQuery.isLoading && <Spinner />}

      {applicationsQuery.isError && (
        <EmptyState>
          <p className="mb-1 font-medium text-slate-700">
            {applicationsQuery.error instanceof ApiClientError
              ? describeRequestError(applicationsQuery.error)
              : 'Không tải được danh sách đơn ứng tuyển.'}
          </p>
          <p className="mb-3">
            Hãy chắc chắn backend TutorHub đang chạy tại{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
          </p>
          <Button variant="secondary" onClick={() => applicationsQuery.refetch()}>
            <RefreshCw className="size-4" /> Thử lại
          </Button>
        </EmptyState>
      )}

      {!applicationsQuery.isLoading && !applicationsQuery.isError && pageData && list.length === 0 && (
        <EmptyState>
          <p className="mb-1 font-medium text-slate-700">Bạn chưa ứng tuyển yêu cầu nào.</p>
          <p className="mb-3">
            Mở <Link to="/requests" className="font-medium text-brand-600 hover:underline">danh sách yêu cầu đang mở</Link>{' '}
            và gửi kèm mức học phí đề xuất.
          </p>
        </EmptyState>
      )}

      {list.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{pageData ? `${pageData.totalElements} đơn ứng tuyển` : ''}</p>

          <ul className="space-y-4">
            {list.map((application) => (
              <li key={application.id}>
                <ApplicationCard
                  application={application}
                  confirmWithdraw={withdrawTarget === application.id}
                  pending={actionMutation.isPending && actionMutation.variables?.applicationId === application.id}
                  onRequestWithdraw={() => setWithdrawTarget(application.id)}
                  onCancelWithdraw={() => setWithdrawTarget(null)}
                  onConfirmWithdraw={() => {
                    actionMutation.mutate({
                      action: 'WITHDRAW',
                      applicationId: application.id,
                      requestId: application.requestId,
                    })
                    setWithdrawTarget(null)
                  }}
                />
              </li>
            ))}
          </ul>

          {pageData && <PageNav page={pageData.page} totalPages={pageData.totalPages} onChange={setPage} />}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  application: Application
  confirmWithdraw: boolean
  pending: boolean
  onRequestWithdraw: () => void
  onCancelWithdraw: () => void
  onConfirmWithdraw: () => void
}

function ApplicationCard({ application, confirmWithdraw, pending, onRequestWithdraw, onCancelWithdraw, onConfirmWithdraw }: CardProps) {
  return (
    <Card
      title={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link to={`/requests/${application.requestId}`} className="truncate text-sm font-semibold text-brand-700 hover:underline">
            Yêu cầu #{application.requestId}
          </Link>
          <Badge tone={STATUS_TONE[application.status]}>{APPLICATION_STATUS_LABEL[application.status]}</Badge>
        </div>
      }
      actions={
        <span className="shrink-0 text-sm font-semibold text-slate-800">{formatVnd(application.proposedRate)}/buổi</span>
      }
    >
      <p className="text-sm text-slate-600">
        {application.message?.trim() ? application.message : 'Bạn không ghi chú gì trong đơn này.'}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Gửi lúc {formatDateTime(application.createdAt)}</span>
        <span>Cập nhật {formatDateTime(application.updatedAt)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/requests/${application.requestId}`} className={linkButtonClass}>
          Mở yêu cầu
        </Link>
        {application.status === 'PENDING' && (
          <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onRequestWithdraw}>
            <Undo2 className="size-4" /> {APPLICATION_ACTION_LABEL.WITHDRAW}
          </Button>
        )}
        {application.status === 'ACCEPTED' && (
          <Link to="/bookings" className={linkButtonClass}>
            Đặt buổi học đầu tiên
          </Link>
        )}
      </div>

      {confirmWithdraw && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
          <p className="text-sm text-red-700">
            Rút đơn khỏi yêu cầu #{application.requestId}? Backend ràng buộc một đơn mỗi gia sư cho một yêu cầu, nên bạn
            không thể ứng tuyển lại yêu cầu này.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1.5" onClick={onCancelWithdraw}>
              Không
            </Button>
            <Button variant="danger" className="px-3 py-1.5" loading={pending} onClick={onConfirmWithdraw}>
              Rút đơn
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
