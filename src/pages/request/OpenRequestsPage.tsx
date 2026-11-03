import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, Filter, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { fetchOpenRequests } from '../../api/request'
import { ApiClientError } from '../../api/client'
import type { SessionMode, TutorRequest } from '../../api/types'
import { REQUEST_STATUS_LABEL, SESSION_MODE_LABEL, STATUS_TONE } from '../../lib/labels'
import { formatDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Input, PageNav, Select, Spinner } from '../../components/ui'
import {
  MODE_VALUES,
  REQUEST_PAGE_SIZE,
  describeRequestError,
  expiryLabel,
  expiryState,
  linkButtonClass,
  openRequestsKey,
  requestFacts,
  useMyTutorProfile,
  useMemoNameMaps,
  useRequestCatalog,
  type Fact,
  type NameMaps,
} from './requestLogic'

const EMPTY_CHILD_NAMES = new Map<number, string>()

interface OpenFilters {
  subjectId: string
  mode: '' | SessionMode
  q: string
}

const NO_FILTERS: OpenFilters = { subjectId: '', mode: '', q: '' }

function isFiltered(filters: OpenFilters): boolean {
  return filters.subjectId !== '' || filters.mode !== '' || filters.q.trim() !== ''
}

/**
 * GET /requests không nhận tham số lọc, nên ba bộ lọc bên dưới chỉ chạy trên đúng TRANG ĐANG XEM
 * và giao diện nói rõ giới hạn đó.
 */
export default function OpenRequestsPage() {
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<OpenFilters>(NO_FILTERS)

  const tutorProfile = useMyTutorProfile(true)
  const catalog = useRequestCatalog()
  const nameMaps: NameMaps = useMemoNameMaps(catalog.subjectNames, catalog.districtNames, EMPTY_CHILD_NAMES)

  // canAct=false thì GET /requests trả 403 (RequestService.tutor đòi VERIFIED) nên tắt query.
  const requestsQuery = useQuery({
    queryKey: openRequestsKey(page),
    queryFn: () => fetchOpenRequests(page, REQUEST_PAGE_SIZE),
    enabled: tutorProfile.canAct,
    refetchInterval: 60_000,
  })

  const pageData = requestsQuery.data
  const list = useMemo(() => pageData?.content ?? [], [pageData])
  const filtered = useMemo(() => applyClientFilters(list, filters, nameMaps), [list, filters, nameMaps])

  if (tutorProfile.isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Yêu cầu tìm gia sư</h1>
        <Spinner />
      </div>
    )
  }

  if (!tutorProfile.canAct) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Yêu cầu tìm gia sư</h1>
        <Card title="Cần xác minh hồ sơ">
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                {tutorProfile.profile == null
                  ? 'Chưa đọc được hồ sơ gia sư của bạn (GET /tutors/me), nên hệ thống chưa cho phép xem yêu cầu.'
                  : `Hồ sơ của bạn chưa ở trạng thái đã xác minh, nên danh sách yêu cầu và đơn ứng tuyển đang bị khóa.`}
                {' '}Backend chỉ mở các endpoint này cho gia sư VERIFIED.
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/tutor" className={linkButtonClass}>
                <ClipboardList className="size-4" /> Mở hồ sơ gia sư
              </Link>
              {tutorProfile.profile == null && (
                <Button variant="secondary" onClick={() => void tutorProfile.refetch()}>
                  <RefreshCw className="size-4" /> Thử lại
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Yêu cầu tìm gia sư đang mở</h1>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách do backend lọc sẵn: chỉ yêu cầu OPEN và chưa quá hạn. Mở yêu cầu để đọc chi tiết và ứng tuyển.
          </p>
        </div>
        <Link to="/applications/mine" className={linkButtonClass}>
          <ClipboardList className="size-4" /> Đơn tôi đã ứng tuyển
        </Link>
      </header>

      <Card
        title={
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter className="size-4" /> Lọc trên trang đang xem
          </span>
        }
        actions={
          <Button
            variant="ghost"
            className="px-2.5 py-1.5"
            disabled={!isFiltered(filters)}
            onClick={() => setFilters(NO_FILTERS)}
          >
            Xóa lọc
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Môn học"
            value={filters.subjectId}
            onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
          >
            <option value="">Tất cả môn</option>
            {catalog.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
          <Select
            label="Hình thức"
            value={filters.mode}
            onChange={(e) => setFilters({ ...filters, mode: e.target.value as '' | SessionMode })}
          >
            <option value="">Tất cả</option>
            {MODE_VALUES.map((mode) => (
              <option key={mode} value={mode}>
                {SESSION_MODE_LABEL[mode]}
              </option>
            ))}
          </Select>
          <Input
            label="Từ khóa"
            placeholder="Mô tả, khu vực, lớp…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          API chỉ nhận page/size, nên bộ lọc chỉ áp dụng cho {list.length} yêu cầu của trang này; sang trang khác
          danh sách được tải lại và bộ lọc trở về mặc định.
        </p>
      </Card>

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

      {!requestsQuery.isLoading && !requestsQuery.isError && requestsQuery.data && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Đang hiển thị {filtered.length}/{requestsQuery.data.content.length} yêu cầu của trang này ·{' '}
            {requestsQuery.data.totalElements} yêu cầu mở toàn hệ thống
          </p>

          {requestsQuery.data.content.length === 0 ? (
            <EmptyState>Chưa có yêu cầu nào đang mở. Hãy thử lại sau.</EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState>
              <p className="mb-2">Không có yêu cầu nào trong trang này khớp bộ lọc.</p>
              <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                Xóa bộ lọc
              </Button>
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {filtered.map((request) => (
                <li key={request.id}>
                  <OpenRequestCard request={request} facts={requestFacts(request, nameMaps)} />
                </li>
              ))}
            </ul>
          )}

          <PageNav
            page={requestsQuery.data.page}
            totalPages={requestsQuery.data.totalPages}
            onChange={(next) => {
              setPage(next)
              // Bộ lọc chỉ có nghĩa trên trang hiện tại nên đổi trang là đặt lại.
              setFilters(NO_FILTERS)
            }}
          />
        </div>
      )}
    </div>
  )
}

function OpenRequestCard({ request, facts }: { request: TutorRequest; facts: Fact[] }) {
  const [headline, ...rest] = facts
  const expiry = expiryState(request)

  return (
    <Card
      title={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-800">
            {headline ? `${headline.value} · Lớp ${request.grade}` : `Yêu cầu #${request.id}`}
          </span>
          <Badge tone={STATUS_TONE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>
          <Badge tone="slate">{SESSION_MODE_LABEL[request.mode]}</Badge>
          {expiry === 'soon' && <Badge tone="amber">Sắp hết hạn</Badge>}
          {expiry === 'past' && <Badge tone="red">Quá hạn</Badge>}
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

      {request.description && <p className="mt-3 line-clamp-3 text-sm text-slate-600">{request.description}</p>}
      {request.scheduleNote && <p className="mt-2 text-sm text-slate-500">Lịch học: {request.scheduleNote}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Đăng lúc {formatDateTime(request.createdAt)}</span>
        {request.expiresAt != null && (
          <span className={expiry === 'soon' ? 'font-medium text-amber-700' : undefined}>{expiryLabel(request)}</span>
        )}
        <span>Người đăng: Phụ huynh (API không trả tên theo id)</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/requests/${request.id}`} className={linkButtonClass}>
          <Search className="size-4" /> Xem &amp; ứng tuyển
        </Link>
        <Link to="/messages" className={linkButtonClass}>
          Nhắn cho phụ huynh
        </Link>
      </div>
    </Card>
  )
}

function applyClientFilters(list: TutorRequest[], filters: OpenFilters, nameMaps: NameMaps): TutorRequest[] {
  const query = filters.q.trim().toLowerCase()
  return list.filter((request) => {
    if (filters.subjectId !== '' && String(request.subjectId) !== filters.subjectId) return false
    if (filters.mode !== '' && request.mode !== filters.mode) return false
    if (query === '') return true
    const haystack = requestFacts(request, nameMaps)
      .map((fact) => fact.value)
      .concat([request.scheduleNote ?? '', request.description ?? '', `lớp ${request.grade}`, `#${request.id}`])
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}
