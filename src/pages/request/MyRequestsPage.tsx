import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Inbox, Pencil, Plus, RefreshCw, XCircle } from 'lucide-react'
import { fetchMyRequests } from '../../api/request'
import { ApiClientError } from '../../api/client'
import type { TutorRequest } from '../../api/types'
import { REQUEST_STATUS_LABEL, SESSION_MODE_LABEL, STATUS_TONE } from '../../lib/labels'
import { formatDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, PageNav, Spinner } from '../../components/ui'
import RequestForm from './RequestForm'
import {
  REQUEST_PAGE_SIZE,
  describeRequestError,
  expiryLabel,
  expiryState,
  linkButtonClass,
  myRequestsKey,
  requestFacts,
  useChildDirectory,
  useCloseRequest,
  useMemoNameMaps,
  useRequestCatalog,
  type Fact,
} from './requestLogic'

export default function MyRequestsPage() {
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<TutorRequest | null>(null)
  const [closeTarget, setCloseTarget] = useState<number | null>(null)

  const catalog = useRequestCatalog()
  const childDirectory = useChildDirectory(true)
  const nameMaps = useMemoNameMaps(catalog.subjectNames, catalog.districtNames, childDirectory.childNames)

  const requestsQuery = useQuery({
    queryKey: myRequestsKey(page),
    queryFn: () => fetchMyRequests(page, REQUEST_PAGE_SIZE),
  })
  const closeMutation = useCloseRequest()

  const pageData = requestsQuery.data
  const list = pageData?.content ?? []
  const formOpen = createOpen || editingRequest != null

  function startCreate() {
    setEditingRequest(null)
    setCreateOpen(true)
  }

  function startEdit(request: TutorRequest) {
    setCreateOpen(false)
    setEditingRequest(request)
  }

  function closeForm() {
    setCreateOpen(false)
    setEditingRequest(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Yêu cầu tìm gia sư của tôi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vào trang chi tiết để xem đơn ứng tuyển và chọn gia sư. Chỉ yêu cầu còn OPEN mới sửa hoặc đóng được.
          </p>
        </div>
        {!formOpen && (
          <Button onClick={startCreate}>
            <Plus className="size-4" /> Tạo yêu cầu
          </Button>
        )}
      </header>

      {createOpen && (
        <RequestForm
          onCancel={closeForm}
          onSaved={() => {
            setCreateOpen(false)
            setPage(0)
          }}
        />
      )}
      {editingRequest != null && (
        <RequestForm request={editingRequest} onCancel={closeForm} onSaved={() => setEditingRequest(null)} />
      )}

      {requestsQuery.isLoading && <Spinner />}

      {requestsQuery.isError && (
        <EmptyState>
          <p className="mb-1 font-medium text-slate-700">
            {requestsQuery.error instanceof ApiClientError
              ? describeRequestError(requestsQuery.error)
              : 'Không tải được danh sách yêu cầu.'}
          </p>
          <p className="mb-3">
            Hãy chắc chắn backend TutorHub đang chạy tại{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
          </p>
          <Button variant="secondary" onClick={() => requestsQuery.refetch()}>
            <RefreshCw className="size-4" /> Thử lại
          </Button>
        </EmptyState>
      )}

      {!requestsQuery.isLoading && !requestsQuery.isError && pageData && list.length === 0 && (
        <EmptyState>
          <p className="mb-1 font-medium text-slate-700">Bạn chưa đăng yêu cầu tìm gia sư nào.</p>
          <p className="mb-3">
            Mô tả môn học, khối lớp và ngân sách — gia sư đã xác minh sẽ thấy yêu cầu và gửi đơn ứng tuyển.
          </p>
          <Button variant="secondary" onClick={startCreate}>
            <Plus className="size-4" /> Tạo yêu cầu đầu tiên
          </Button>
        </EmptyState>
      )}

      {list.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>{pageData ? `${pageData.totalElements} yêu cầu đã đăng` : ''}</p>
            <div className="flex gap-3">
              <Link to="/parent" className="font-medium text-brand-600 hover:underline">
                Hồ sơ phụ huynh
              </Link>
              <Link to="/bookings" className="font-medium text-brand-600 hover:underline">
                Lịch học
              </Link>
            </div>
          </div>

          <ul className="space-y-4">
            {list.map((request) => (
              <li key={request.id}>
                <RequestCard
                  request={request}
                  facts={requestFacts(request, nameMaps)}
                  onEdit={() => startEdit(request)}
                  onRequestClose={() => setCloseTarget(request.id)}
                  closing={closeMutation.isPending && closeMutation.variables === request.id}
                  confirmClose={closeTarget === request.id}
                  onConfirmClose={() => {
                    closeMutation.mutate(request.id)
                    setCloseTarget(null)
                  }}
                  onCancelClose={() => setCloseTarget(null)}
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
  request: TutorRequest
  facts: Fact[]
  onEdit: () => void
  onRequestClose: () => void
  closing: boolean
  confirmClose: boolean
  onConfirmClose: () => void
  onCancelClose: () => void
}

function RequestCard({ request, facts, onEdit, onRequestClose, closing, confirmClose, onConfirmClose, onCancelClose }: CardProps) {
  const isOpen = request.status === 'OPEN'
  const expiry = expiryState(request)
  const [headline, ...rest] = facts

  return (
    <Card
      title={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-800">
            {headline ? `${headline.value} · Lớp ${request.grade}` : `Yêu cầu #${request.id}`}
          </span>
          <Badge tone={STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>
          <Badge tone="slate">{SESSION_MODE_LABEL[request.mode]}</Badge>
          {isOpen && expiry === 'soon' && <Badge tone="amber">Sắp hết hạn</Badge>}
        </div>
      }
      actions={<span className="shrink-0 text-xs text-slate-400">#{request.id}</span>}
    >
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{fact.label}</dt>
            <dd className="font-medium text-slate-800">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {(request.scheduleNote || request.description) && (
        <p className="mt-3 line-clamp-3 text-sm text-slate-600">{request.scheduleNote ?? request.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Tạo lúc {formatDateTime(request.createdAt)}</span>
        {isOpen && request.expiresAt != null && (
          <span className={expiry === 'soon' ? 'font-medium text-amber-700' : undefined}>{expiryLabel(request)}</span>
        )}
        {isOpen && request.expiresAt == null && <span>Không đặt ngày hết hạn</span>}
        {/* Đếm đơn cần GET /requests/{id}/applications cho từng dòng nên chỉ hiển thị ở trang chi tiết. */}
        <span className="text-slate-400">Đơn ứng tuyển: xem trong trang chi tiết</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/requests/${request.id}`} className={linkButtonClass}>
          <Inbox className="size-4" /> Xem chi tiết &amp; đơn ứng tuyển
        </Link>
        {isOpen && (
          <Button variant="secondary" onClick={onEdit}>
            <Pencil className="size-4" /> Sửa
          </Button>
        )}
        {isOpen && (
          <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onRequestClose}>
            <XCircle className="size-4" /> Đóng yêu cầu
          </Button>
        )}
      </div>

      {confirmClose && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
          <p className="text-sm text-red-700">
            Đóng yêu cầu #{request.id}? Gia sư sẽ không ứng tuyển được nữa và đơn còn chờ không thể được chọn.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1.5" onClick={onCancelClose}>
              Không
            </Button>
            <Button variant="danger" className="px-3 py-1.5" loading={closing} onClick={onConfirmClose}>
              Đóng ngay
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
