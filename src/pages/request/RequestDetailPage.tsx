import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  ShieldAlert,
  Undo2,
  X,
  XCircle,
} from 'lucide-react'
import { ApiClientError } from '../../api/client'
import { fetchRequestApplications } from '../../api/request'
import type { Application, RequestStatus, TutorProfileMine, TutorRequest } from '../../api/types'
import { APPLICATION_STATUS_LABEL, REQUEST_STATUS_LABEL, SESSION_MODE_LABEL, STATUS_TONE } from '../../lib/labels'
import { formatDateTime, formatVnd } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Input, Spinner, Textarea } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import RequestForm from './RequestForm'
import {
  APPLICATION_ACTION_LABEL,
  MESSAGE_MAX,
  OWN_APPLICATION_SCAN_SIZE,
  RATE_STEP,
  budgetLabel,
  describeRequestError,
  expiryLabel,
  expiryState,
  linkButtonClass,
  ownApplicationQueryOptions,
  requestApplicationsKey,
  requestFacts,
  requestQueryOptions,
  useApplicationActionMutation,
  useApplyToRequest,
  useChildDirectory,
  useCloseRequest,
  useMyTutorProfile,
  useMemoNameMaps,
  useRequestCatalog,
  validateRate,
  type ApplicationAction,
  type Fact,
} from './requestLogic'

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const requestId = Number(id)
  const validId = Number.isInteger(requestId) && requestId > 0
  const { user } = useAuth()

  const isParentViewer = user?.role === 'PARENT'
  const isTutorViewer = user?.role === 'TUTOR'

  const catalog = useRequestCatalog()
  const tutorProfile = useMyTutorProfile(isTutorViewer)
  const requestQuery = useQuery({ ...requestQueryOptions(requestId), enabled: validId })
  const request = requestQuery.data ?? null

  const isOwner = isParentViewer && request != null && user != null && request.parentId === user.id
  const childDirectory = useChildDirectory(isOwner)
  const nameMaps = useMemoNameMaps(catalog.subjectNames, catalog.districtNames, childDirectory.childNames)

  // GET /requests/{id}/applications chỉ phụ huynh sở hữu yêu cầu gọi được.
  const applicationsQuery = useQuery({
    queryKey: requestApplicationsKey(requestId),
    queryFn: () => fetchRequestApplications(requestId),
    enabled: isOwner,
  })

  // Không có endpoint "đơn của tôi trong yêu cầu X" → quét /applications/mine (100 đơn gần nhất).
  const ownApplicationsQuery = useQuery({
    ...ownApplicationQueryOptions(0, OWN_APPLICATION_SCAN_SIZE),
    enabled: isTutorViewer && tutorProfile.canAct,
  })
  const ownApplication = useMemo<Application | null>(() => {
    const rows = ownApplicationsQuery.data?.content ?? []
    return rows.find((row) => row.requestId === requestId) ?? null
  }, [ownApplicationsQuery.data, requestId])

  const [editOpen, setEditOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const closeMutation = useCloseRequest()

  if (!validId) {
    return (
      <EmptyState>
        <p className="mb-1 font-medium text-slate-700">Đường dẫn không hợp lệ.</p>
        <p>
          Mã yêu cầu “{id}” không phải số nguyên dương.{' '}
          <Link to="/requests" className="font-medium text-brand-600 hover:underline">
            Về danh sách yêu cầu
          </Link>
        </p>
      </EmptyState>
    )
  }

  if (requestQuery.isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Yêu cầu tìm gia sư</h1>
        <Spinner />
      </div>
    )
  }

  if (requestQuery.isError || request == null) {
    return (
      <div className="space-y-4">
        <BackLink role={user?.role} />
        <EmptyState>
          <p className="mb-1 font-medium text-slate-700">
            {requestQuery.error instanceof ApiClientError
              ? describeRequestError(requestQuery.error)
              : 'Không tải được yêu cầu.'}
          </p>
          <p className="mb-3 text-left">
            {isTutorViewer
              ? 'Phía gia sư chỉ xem được yêu cầu còn OPEN và chưa quá hạn; yêu cầu đã ghép, đã đóng hoặc hết hạn trả về 404.'
              : 'Chỉ phụ huynh đã đăng yêu cầu này mới đọc được trang chi tiết.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => requestQuery.refetch()}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
            {isTutorViewer && (
              <Link to="/requests" className={linkButtonClass}>
                Yêu cầu đang mở
              </Link>
            )}
          </div>
        </EmptyState>
      </div>
    )
  }

  const facts = requestFacts(request, nameMaps)
  const expiry = expiryState(request)
  // Job expire() chạy mỗi 60 giây nên một yêu cầu có thể còn OPEN nhưng đã quá hạn với người xem.
  const acceptApplications = request.status === 'OPEN' && expiry !== 'past'

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <BackLink role={user?.role} />
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {facts[0]?.value ?? `Yêu cầu #${request.id}`} · Lớp {request.grade}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          <Badge tone="slate">{SESSION_MODE_LABEL[request.mode]}</Badge>
          {request.status === 'OPEN' && expiry === 'past' && <Badge tone="red">Đã quá hạn</Badge>}
          {request.status === 'OPEN' && expiry === 'soon' && <Badge tone="amber">Sắp hết hạn</Badge>}
          <span className="text-xs text-slate-400">#{request.id}</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Người đăng: Phụ huynh (API không trả tên theo id) · Tạo lúc {formatDateTime(request.createdAt)}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <RequestSummaryCard
          request={request}
          facts={facts.slice(1)}
          isOwner={isOwner}
          acceptApplications={acceptApplications}
          editOpen={editOpen}
          confirmClose={confirmClose}
          closing={closeMutation.isPending}
          onToggleEdit={() => setEditOpen((value) => !value)}
          onDoneEdit={() => setEditOpen(false)}
          onRequestClose={() => setConfirmClose(true)}
          onCancelClose={() => setConfirmClose(false)}
          onConfirmClose={() => {
            closeMutation.mutate(request.id)
            setConfirmClose(false)
          }}
        />

        {isOwner ? (
          <ApplicationsPanel
            request={request}
            isLoading={applicationsQuery.isLoading}
            isError={applicationsQuery.isError}
            applications={applicationsQuery.data ?? []}
          />
        ) : isTutorViewer ? (
          <TutorPanel
            request={request}
            acceptApplications={acceptApplications}
            profile={tutorProfile.profile}
            canAct={tutorProfile.canAct}
            ownApplication={ownApplication}
            isScanning={isTutorViewer && tutorProfile.canAct && ownApplicationsQuery.isLoading}
          />
        ) : (
          <Card title="Không có thao tác nào">
            <p className="text-sm text-slate-600">
              Bạn không phải phụ huynh đã đăng yêu cầu này nên không đọc được đơn ứng tuyển. Gia sư chỉ thao tác được
              với yêu cầu còn mở.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

function BackLink({ role }: { role: string | undefined }) {
  const isParent = role === 'PARENT'
  return (
    <Link
      to={isParent ? '/requests/mine' : '/requests'}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600"
    >
      <ArrowLeft className="size-4" /> {isParent ? 'Yêu cầu của tôi' : 'Yêu cầu đang mở'}
    </Link>
  )
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{REQUEST_STATUS_LABEL[status]}</Badge>
}

interface SummaryProps {
  request: TutorRequest
  facts: Fact[]
  isOwner: boolean
  acceptApplications: boolean
  editOpen: boolean
  confirmClose: boolean
  closing: boolean
  onToggleEdit: () => void
  onDoneEdit: () => void
  onRequestClose: () => void
  onCancelClose: () => void
  onConfirmClose: () => void
}

function RequestSummaryCard({
  request,
  facts,
  isOwner,
  acceptApplications,
  editOpen,
  confirmClose,
  closing,
  onToggleEdit,
  onDoneEdit,
  onRequestClose,
  onCancelClose,
  onConfirmClose,
}: SummaryProps) {
  if (editOpen && isOwner) {
    return <RequestForm request={request} onCancel={onDoneEdit} onSaved={onDoneEdit} />
  }

  const isOpen = request.status === 'OPEN'

  return (
    <Card title="Thông tin yêu cầu">
      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{fact.label}</dt>
            <dd className="font-medium text-slate-800">{fact.value}</dd>
          </div>
        ))}
        {request.expiresAt != null && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Hạn nhận đơn</dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(request.expiresAt)} · {expiryLabel(request)}
            </dd>
          </div>
        )}
        {request.scheduleNote && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Ghi chú lịch học</dt>
            <dd className="text-slate-700">{request.scheduleNote}</dd>
          </div>
        )}
        {request.description && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Mô tả chi tiết</dt>
            <dd className="whitespace-pre-line text-slate-700">{request.description}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {isOwner && isOpen && (
          <>
            <Button variant="secondary" onClick={onToggleEdit}>
              <Pencil className="size-4" /> Sửa yêu cầu
            </Button>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onRequestClose}>
              <XCircle className="size-4" /> Đóng yêu cầu
            </Button>
          </>
        )}
        <Link to="/messages" className={linkButtonClass}>
          <MessageSquare className="size-4" /> Nhắn tin
        </Link>
      </div>

      {isOwner && request.status === 'MATCHED' && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
          Đã ghép gia sư. Hai bên thống nhất thời gian rồi đặt lịch trong mục Lịch học.
        </p>
      )}

      {!acceptApplications && isOpen && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          Yêu cầu đã quá hạn nhưng tiến trình hết hạn của backend chưa chuyển trạng thái EXPIRED — hệ thống đang chặn
          đơn mới.
        </p>
      )}

      {confirmClose && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
          <p className="text-sm text-red-700">Đóng yêu cầu #{request.id}? Gia sư sẽ không ứng tuyển được nữa.</p>
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

interface ApplicationsProps {
  request: TutorRequest
  isLoading: boolean
  isError: boolean
  applications: Application[]
}

function ApplicationsPanel({ request, isLoading, isError, applications }: ApplicationsProps) {
  const [confirm, setConfirm] = useState<{ action: ApplicationAction; application: Application } | null>(null)
  const actionMutation = useApplicationActionMutation()
  const pendingCount = applications.filter((row) => row.status === 'PENDING').length

  return (
    <Card
      title={
        <span className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
          Đơn ứng tuyển
          <Badge tone={pendingCount > 0 ? 'amber' : 'slate'}>{pendingCount} đang chờ</Badge>
          <span className="text-xs font-normal text-slate-500">tổng {applications.length}</span>
        </span>
      }
    >
      {isLoading && <Spinner />}

      {isError && (
        <p className="text-sm text-red-600">
          Không tải được danh sách ứng viên — endpoint này chỉ mở cho phụ huynh đã đăng yêu cầu.
        </p>
      )}

      {!isLoading && !isError && applications.length === 0 && (
        <EmptyState>
          <p className="mb-1 font-medium text-slate-700">Chưa có gia sư nào ứng tuyển.</p>
          <p>
            Yêu cầu đang hiển thị trong danh sách dành cho gia sư đã xác minh. Ngân sách đang ghi:{' '}
            {budgetLabel(request.budgetMin, request.budgetMax)}.
          </p>
        </EmptyState>
      )}

      {!isLoading && !isError && applications.length > 0 && (
        <ul className="space-y-4">
          {applications.map((application) => (
            <ApplicationRow
              key={application.id}
              application={application}
              budgetMin={request.budgetMin}
              budgetMax={request.budgetMax}
              confirmAction={confirm?.application.id === application.id ? confirm.action : null}
              pending={actionMutation.isPending && actionMutation.variables?.applicationId === application.id}
              onRequest={(action) => setConfirm({ action, application })}
              onCancel={() => setConfirm(null)}
              onConfirm={() => {
                if (confirm == null) return
                actionMutation.mutate({
                  action: confirm.action,
                  applicationId: confirm.application.id,
                  requestId: request.id,
                })
                setConfirm(null)
              }}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Nhận đơn chạy trong transaction có row lock: đơn được chọn đầu tiên thắng, các đơn PENDING còn lại tự chuyển
        REJECTED và yêu cầu thành MATCHED. Nếu một tab khác đã chọn trước, thao tác của bạn sẽ bị 404/409.
      </p>
    </Card>
  )
}

interface RowProps {
  application: Application
  budgetMin: number | null
  budgetMax: number | null
  confirmAction: ApplicationAction | null
  pending: boolean
  onRequest: (action: ApplicationAction) => void
  onCancel: () => void
  onConfirm: () => void
}

function ApplicationRow({ application, budgetMin, budgetMax, confirmAction, pending, onRequest, onCancel, onConfirm }: RowProps) {
  const overBudget = budgetMax != null && application.proposedRate > budgetMax
  const underBudget = budgetMin != null && application.proposedRate < budgetMin

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/tutors/${application.tutorId}`} className="text-sm font-semibold text-brand-700 hover:underline">
            Gia sư #{application.tutorId}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            Mở hồ sơ công khai để xem tên; API không trả tên gia sư theo id cho phụ huynh.
          </p>
        </div>
        <Badge tone={STATUS_TONE[application.status]}>{APPLICATION_STATUS_LABEL[application.status]}</Badge>
      </div>

      <p className="mt-2 text-sm font-medium text-slate-800">
        Học phí đề xuất: {formatVnd(application.proposedRate)}/buổi
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {overBudget && <Badge tone="red">Cao hơn ngân sách tối đa</Badge>}
        {!overBudget && underBudget && <Badge tone="blue">Thấp hơn ngân sách tối thiểu</Badge>}
      </div>

      {application.message?.trim() ? (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{application.message}</p>
      ) : (
        <p className="mt-2 text-sm italic text-slate-400">Gia sư không để lại lời nhắn.</p>
      )}

      <p className="mt-2 text-xs text-slate-500">Gửi lúc {formatDateTime(application.createdAt)}</p>

      {application.status === 'PENDING' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="px-3 py-1.5" onClick={() => onRequest('ACCEPT')}>
            <Check className="size-4" /> {APPLICATION_ACTION_LABEL.ACCEPT}
          </Button>
          <Button variant="secondary" className="px-3 py-1.5" onClick={() => onRequest('REJECT')}>
            <X className="size-4" /> {APPLICATION_ACTION_LABEL.REJECT}
          </Button>
        </div>
      )}

      {confirmAction != null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          <p className="text-sm text-slate-700">
            {confirmAction === 'ACCEPT'
              ? `Chọn gia sư #${application.tutorId}? Những đơn còn lại của yêu cầu này sẽ bị từ chối.`
              : `Từ chối đơn của gia sư #${application.tutorId}?`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1.5" onClick={onCancel}>
              Không
            </Button>
            <Button
              variant={confirmAction === 'ACCEPT' ? 'primary' : 'danger'}
              className="px-3 py-1.5"
              loading={pending}
              onClick={onConfirm}
            >
              Xác nhận
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

interface TutorPanelProps {
  request: TutorRequest
  acceptApplications: boolean
  profile: TutorProfileMine | null
  canAct: boolean
  ownApplication: Application | null
  isScanning: boolean
}

function TutorPanel({ request, acceptApplications, profile, canAct, ownApplication, isScanning }: TutorPanelProps) {
  const [withdrawConfirm, setWithdrawConfirm] = useState(false)
  const actionMutation = useApplicationActionMutation()

  if (!canAct) {
    return (
      <Card title="Ứng tuyển">
        <p className="flex items-start gap-2 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {profile == null
              ? 'Chưa đọc được hồ sơ gia sư của bạn (GET /tutors/me).'
              : 'Hồ sơ của bạn chưa ở trạng thái đã xác minh, nên backend chặn đơn ứng tuyển.'}{' '}
            Hoàn thiện và nộp hồ sơ ở trang gia sư để mở quyền ứng tuyển.
          </span>
        </p>
        <div className="mt-4">
          <Link to="/tutor" className={linkButtonClass}>
            Mở hồ sơ gia sư
          </Link>
        </div>
      </Card>
    )
  }

  if (isScanning && ownApplication == null) {
    return (
      <Card title="Đơn của bạn">
        <Spinner />
      </Card>
    )
  }

  if (ownApplication != null) {
    return (
      <Card title="Đơn của bạn">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[ownApplication.status]}>{APPLICATION_STATUS_LABEL[ownApplication.status]}</Badge>
          <span className="text-sm font-medium text-slate-800">{formatVnd(ownApplication.proposedRate)}/buổi</span>
        </div>

        {ownApplication.message?.trim() ? (
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{ownApplication.message}</p>
        ) : (
          <p className="mt-2 text-sm italic text-slate-400">Bạn không ghi chú gì trong đơn này.</p>
        )}
        <p className="mt-2 text-xs text-slate-500">Gửi lúc {formatDateTime(ownApplication.createdAt)}</p>

        {ownApplication.status === 'PENDING' ? (
          <>
            <div className="mt-4">
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setWithdrawConfirm(true)}>
                <Undo2 className="size-4" /> {APPLICATION_ACTION_LABEL.WITHDRAW}
              </Button>
            </div>
            {withdrawConfirm && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
                <p className="text-sm text-red-700">
                  Rút đơn? Backend ràng buộc một đơn mỗi gia sư cho một yêu cầu, nên bạn sẽ không ứng tuyển lại được.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1.5" onClick={() => setWithdrawConfirm(false)}>
                    Không
                  </Button>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5"
                    loading={actionMutation.isPending}
                    onClick={() => {
                      actionMutation.mutate({
                        action: 'WITHDRAW',
                        applicationId: ownApplication.id,
                        requestId: request.id,
                      })
                      setWithdrawConfirm(false)
                    }}
                  >
                    Rút đơn
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Đơn đã được xử lý nên không rút hay gửi lại được. Theo dõi các đơn khác trong{' '}
            <Link to="/applications/mine" className="font-medium text-brand-600 hover:underline">
              danh sách đơn của tôi
            </Link>
            .
          </p>
        )}
      </Card>
    )
  }

  if (!acceptApplications) {
    return (
      <Card title="Ứng tuyển">
        <p className="text-sm text-slate-600">
          Yêu cầu không còn ở trạng thái mở{request.status === 'MATCHED' ? ' (đã ghép gia sư khác)' : ''}, nên hệ thống
          không nhận đơn mới.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/requests" className={linkButtonClass}>
            Tìm yêu cầu khác
          </Link>
          <Link to="/applications/mine" className={linkButtonClass}>
            Đơn tôi đã ứng tuyển
          </Link>
        </div>
      </Card>
    )
  }

  return <ApplyCard request={request} hourlyRate={profile?.hourlyRate ?? null} />
}

interface ApplyProps {
  request: TutorRequest
  hourlyRate: number | null
}

function ApplyCard({ request, hourlyRate }: ApplyProps) {
  const [message, setMessage] = useState('')
  const [rate, setRate] = useState(hourlyRate != null && hourlyRate > 0 ? String(hourlyRate) : '')
  const [showErrors, setShowErrors] = useState(false)
  const mutation = useApplyToRequest(request.id)

  const rateCheck = validateRate(rate)
  const tooLong = message.length > MESSAGE_MAX
  const proposedRate = rateCheck.value ?? 0
  const overBudget = request.budgetMax != null && proposedRate > request.budgetMax

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setShowErrors(true)
    if (rateCheck.error != null || tooLong) return
    const note = message.trim()
    mutation.mutate({ message: note === '' ? undefined : note, proposedRate })
  }

  return (
    <Card title="Ứng tuyển yêu cầu này">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Ngân sách phụ huynh đưa ra: {budgetLabel(request.budgetMin, request.budgetMax)}
          {hourlyRate != null && hourlyRate > 0 ? ` · Học phí trong hồ sơ của bạn: ${formatVnd(hourlyRate)}/buổi` : ''}.
        </p>

        <div>
          <Input
            label="Học phí đề xuất (VND/buổi)"
            type="number"
            min={0}
            step={RATE_STEP}
            inputMode="numeric"
            required
            value={rate}
            disabled={mutation.isPending}
            onChange={(e) => setRate(e.target.value)}
            hint="Số nguyên không âm, tính cho mỗi buổi."
          />
          {showErrors && rateCheck.error != null && <p className="text-xs font-medium text-red-600">{rateCheck.error}</p>}
          {!tooLong && rateCheck.error == null && overBudget && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Mức này cao hơn ngân sách tối đa của yêu cầu — phụ huynh vẫn thấy đơn nhưng dễ bị bỏ qua.
            </p>
          )}
        </div>

        <div>
          <Textarea
            label="Lời nhắn cho phụ huynh (không bắt buộc)"
            placeholder="Kinh nghiệm dạy môn này, khung giờ trống, cách bạn dự định hỗ trợ con…"
            value={message}
            maxLength={MESSAGE_MAX}
            rows={4}
            disabled={mutation.isPending}
            onChange={(e) => setMessage(e.target.value)}
            hint={`${message.length}/${MESSAGE_MAX} ký tự`}
          />
          {tooLong && <p className="text-xs font-medium text-red-600">Lời nhắn tối đa {MESSAGE_MAX} ký tự.</p>}
        </div>

        {mutation.isError && (
          <div className="space-y-1 rounded-lg bg-red-50 px-3 py-2 ring-1 ring-red-200">
            <p className="text-sm text-red-700">{describeRequestError(mutation.error)}</p>
            {isBlockedError(mutation.error) && (
              <p className="text-xs text-red-700">
                Thường do hồ sơ chưa được duyệt hoặc bạn đã có đơn cho yêu cầu này —{' '}
                <Link to="/tutor" className="font-medium underline">
                  mở trang gia sư
                </Link>{' '}
                để kiểm tra trạng thái xác minh.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link to="/messages" className={linkButtonClass}>
            <MessageSquare className="size-4" /> Nhắn cho phụ huynh
          </Link>
          <Button type="submit" loading={mutation.isPending} disabled={tooLong}>
            <Send className="size-4" /> Gửi đơn ứng tuyển
          </Button>
        </div>
      </form>
    </Card>
  )
}

/** 403/409 khi ứng tuyển thường nghĩa là hồ sơ chưa VERIFIED hoặc đã tồn tại đơn cho yêu cầu này. */
function isBlockedError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 403 || error.status === 409)
}
