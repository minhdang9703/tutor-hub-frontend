import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, FileText, Inbox, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { fetchPendingTutors, fetchTutorForReview, rejectTutor, reviewDocument, verifyTutor } from '../../api/admin'
import { fetchDistricts } from '../../api/catalog'
import { ApiClientError } from '../../api/client'
import type { TutorProfileMine } from '../../api/types'
import { EDUCATION_LABEL, MODE_LABEL, STATUS_TONE, VERIFICATION_STATUS_LABEL } from '../../lib/labels'
import { formatVnd } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Input, PageNav, Select, Spinner, Textarea } from '../../components/ui'
import { ADMIN_PAGE_SIZE, REASON_MAX, notifyQueryError } from './adminLabels'

interface TutorDecision {
  userId: number
  fullName: string
  reason?: string
}

export default function PendingTutorsPanel() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  const tutorsQuery = useQuery({
    queryKey: ['admin', 'tutors', page],
    queryFn: () => fetchPendingTutors(page, ADMIN_PAGE_SIZE),
  })

  /**
   * Hàng đợi chỉ chứa hồ sơ PENDING nên sau mỗi quyết định phải reload danh sách;
   * hồ sơ trong drawer và /admin/stats cũng đổi theo (activeTutors đếm hồ sơ VERIFIED).
   */
  function invalidateAfterDecision(decision: TutorDecision) {
    queryClient.invalidateQueries({ queryKey: ['admin', 'tutors'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'tutor', decision.userId] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
  }

  const verifyMutation = useMutation({
    mutationFn: (decision: TutorDecision) => verifyTutor(decision.userId),
    onSuccess: (_result, decision) => {
      invalidateAfterDecision(decision)
      setSelectedUserId(null)
      toast.success(`Đã xác minh hồ sơ của ${decision.fullName}.`)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (decision: TutorDecision) => rejectTutor(decision.userId, decision.reason ?? ''),
    onSuccess: (_result, decision) => {
      invalidateAfterDecision(decision)
      setSelectedUserId(null)
      toast.success(`Đã từ chối hồ sơ của ${decision.fullName}. Gia sư nhận thông báo kèm lý do.`)
    },
  })

  const list = tutorsQuery.data?.content ?? []

  return (
    <div className="space-y-6">
      <Card title="Hàng đợi duyệt hồ sơ gia sư">
        {tutorsQuery.isLoading && <Spinner />}
        {tutorsQuery.isError && (
          <EmptyState>
            <p className="mb-1 font-medium text-slate-700">
              {tutorsQuery.error instanceof ApiClientError && tutorsQuery.error.status === 403
                ? 'Tài khoản hiện tại không có vai trò ADMIN nên /admin/tutors trả 403.'
                : 'Không tải được hàng đợi duyệt.'}
            </p>
            <p className="mb-3">
              Hãy chắc chắn backend TutorHub đang chạy tại{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
            </p>
            <Button variant="secondary" onClick={() => void tutorsQuery.refetch().then(notifyQueryError)}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
          </EmptyState>
        )}

        {!tutorsQuery.isLoading && !tutorsQuery.isError && list.length === 0 && (
          <EmptyState>
            <p className="mb-1 font-medium text-slate-700">Không còn hồ sơ nào chờ duyệt.</p>
            <p>Hồ sơ chỉ xuất hiện ở đây khi gia sư bấm “Nộp hồ sơ duyệt” trong khu vực của họ.</p>
          </EmptyState>
        )}

        {list.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {tutorsQuery.data ? `${tutorsQuery.data.totalElements} hồ sơ đang chờ duyệt · ` : ''}
              Backend sắp xếp theo <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">updated_at</code> tăng dần
              (hồ sơ nộp lâu nhất hiện trước) và không nhận tham số sắp xếp.
            </p>
            <ul className="divide-y divide-slate-100">
              {list.map((tutor) => (
                <TutorRow
                  key={tutor.userId}
                  tutor={tutor}
                  selected={selectedUserId === tutor.userId}
                  onOpen={() => setSelectedUserId(tutor.userId)}
                />
              ))}
            </ul>
            {tutorsQuery.data && (
              <PageNav page={tutorsQuery.data.page} totalPages={tutorsQuery.data.totalPages} onChange={setPage} />
            )}
          </div>
        )}
      </Card>

      <DocumentReviewCard />

      {selectedUserId != null && (
        <ReviewDrawer
          userId={selectedUserId}
          approving={verifyMutation.isPending}
          rejecting={rejectMutation.isPending}
          onClose={() => setSelectedUserId(null)}
          onApprove={(fullName) => verifyMutation.mutate({ userId: selectedUserId, fullName })}
          onReject={(fullName, reason) => rejectMutation.mutate({ userId: selectedUserId, fullName, reason })}
        />
      )}
    </div>
  )
}

function TutorRow({ tutor, selected, onOpen }: { tutor: TutorProfileMine; selected: boolean; onOpen: () => void }) {
  return (
    <li className="py-2">
      <button
        type="button"
        onClick={onOpen}
        className={
          selected
            ? 'flex w-full items-start gap-3 rounded-lg bg-brand-50 px-2 py-2 text-left transition'
            : 'flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50'
        }
      >
        <Inbox className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{tutor.fullName}</span>
            <Badge tone={STATUS_TONE[tutor.verificationStatus]}>{VERIFICATION_STATUS_LABEL[tutor.verificationStatus]}</Badge>
            <span className="text-xs text-slate-400">Người dùng #{tutor.userId}</span>
          </span>
          {tutor.headline && <span className="mt-1 block truncate text-sm text-slate-600">{tutor.headline}</span>}
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{formatVnd(tutor.hourlyRate)}/giờ</span>
            <span>{MODE_LABEL[tutor.teachingMode]}</span>
            <span>{educationLabel(tutor.educationLevel)}</span>
            <span>{tutor.yearsExperience} năm kinh nghiệm</span>
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-brand-600">Xem hồ sơ</span>
      </button>
    </li>
  )
}

/** educationLevel là chuỗi tự do trong DTO nên luôn cần nhãn gốc nếu giá trị lạ hơn enum. */
function educationLabel(level: string | null): string {
  if (!level) return 'Chưa ghi trình độ'
  return EDUCATION_LABEL[level] ?? level
}

interface DrawerProps {
  userId: number
  approving: boolean
  rejecting: boolean
  onClose: () => void
  onApprove: (fullName: string) => void
  onReject: (fullName: string, reason: string) => void
}

type DrawerMode = 'idle' | 'approve' | 'reject'

function ReviewDrawer({ userId, approving, rejecting, onClose, onApprove, onReject }: DrawerProps) {
  const reviewQuery = useQuery({ queryKey: ['admin', 'tutor', userId], queryFn: () => fetchTutorForReview(userId) })
  const districtsQuery = useQuery({ queryKey: ['catalog', 'districts'], queryFn: () => fetchDistricts() })
  const [mode, setMode] = useState<DrawerMode>('idle')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const profile = reviewQuery.data
  const busy = approving || rejecting
  const districtName =
    profile?.districtId == null
      ? null
      : (districtsQuery.data?.find((district) => district.id === profile.districtId)?.name ?? null)

  /** TutorService.verify/reject chỉ cập nhật hồ sơ còn PENDING, nên ngoài trạng thái đó phải khóa hành động. */
  const decidable = profile?.verificationStatus === 'PENDING'

  function submitReject() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setReasonError('Lý do là bắt buộc — backend trả REJECT_REASON_REQUIRED khi để trống.')
      return
    }
    if (trimmed.length > REASON_MAX) {
      setReasonError(`Lý do tối đa ${REASON_MAX} ký tự (hiện đang ${trimmed.length}).`)
      return
    }
    setReasonError(null)
    if (profile) onReject(profile.fullName, trimmed)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Đóng bảng xem hồ sơ" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Hồ sơ gia sư ${userId}`}
        className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl"
      >
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">{profile ? profile.fullName : `Hồ sơ gia sư #${userId}`}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Id người dùng: {userId}</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Đóng">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 px-5 py-4">
          {reviewQuery.isLoading && <Spinner />}
          {reviewQuery.isError && (
            <EmptyState>
              <p className="mb-2 font-medium text-slate-700">Không mở được hồ sơ chi tiết.</p>
              <p className="mb-3 text-xs">Backend trả NOT_FOUND nếu người dùng này chưa có hồ sơ gia sư.</p>
              <Button variant="secondary" onClick={() => void reviewQuery.refetch().then(notifyQueryError)}>
                <RefreshCw className="size-4" /> Thử lại
              </Button>
            </EmptyState>
          )}

          {profile && (
            <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              <DrawerField label="Trạng thái duyệt">
                <Badge tone={STATUS_TONE[profile.verificationStatus]}>
                  {VERIFICATION_STATUS_LABEL[profile.verificationStatus]}
                </Badge>
              </DrawerField>
              <DrawerField label="Học phí">{formatVnd(profile.hourlyRate)}/giờ</DrawerField>
              <DrawerField label="Hình thức dạy">{MODE_LABEL[profile.teachingMode]}</DrawerField>
              <DrawerField label="Trình độ">{educationLabel(profile.educationLevel)}</DrawerField>
              <DrawerField label="Trường / nơi công tác">{profile.school || '—'}</DrawerField>
              <DrawerField label="Chuyên ngành">{profile.major || '—'}</DrawerField>
              <DrawerField label="Kinh nghiệm">{profile.yearsExperience} năm</DrawerField>
              <DrawerField label="Khu vực">
                {profile.districtId == null ? 'Không chọn quận/huyện' : (districtName ?? `Quận/huyện #${profile.districtId}`)}
              </DrawerField>
              <div className="sm:col-span-2">
                <DrawerField label="Tiêu đề hồ sơ">{profile.headline || '—'}</DrawerField>
              </div>
              <div className="sm:col-span-2">
                <DrawerField label="Giới thiệu bản thân">{profile.bio || '—'}</DrawerField>
              </div>
            </dl>
          )}

          <p className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <FileText className="mt-0.5 size-4 shrink-0" />
            Không có endpoint nào cho admin liệt kê giấy tờ của một hồ sơ, nên drawer không hiển thị ảnh/PDF đính kèm.
            Xem khối “Duyệt giấy tờ theo ID” bên dưới hàng đợi.
          </p>

          {profile && !decidable && (
            <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Hồ sơ không còn ở trạng thái chờ duyệt nên hành động duyệt bị khóa — backend sẽ trả INVALID_TUTOR_STATUS.
            </p>
          )}
        </div>

        {profile && decidable && (
          <footer className="sticky bottom-0 space-y-3 border-t border-slate-100 bg-white px-5 py-4">
            {mode === 'idle' && (
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => setMode('approve')}>
                  <ShieldCheck className="size-4" /> Duyệt hồ sơ
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => setMode('reject')}>
                  <X className="size-4" /> Từ chối
                </Button>
              </div>
            )}

            {mode === 'approve' && (
              <div className="space-y-3">
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Xác nhận duyệt hồ sơ của {profile.fullName}? Profile sẽ công khai với phụ huynh ngay và gia sư nhận
                  thông báo “Profile verified”.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => setMode('idle')}>
                    Quay lại
                  </Button>
                  <Button loading={approving} disabled={busy} onClick={() => onApprove(profile.fullName)}>
                    <Check className="size-4" /> Xác nhận duyệt
                  </Button>
                </div>
              </div>
            )}

            {mode === 'reject' && (
              <div className="space-y-3">
                <Textarea
                  label="Lý do từ chối (bắt buộc, gia sư nhìn thấy)"
                  value={reason}
                  maxLength={REASON_MAX}
                  onChange={(event) => setReason(event.target.value)}
                  hint={reasonError ?? `Tối đa ${REASON_MAX} ký tự · hiện ${reason.trim().length}/${REASON_MAX}`}
                  className={reasonError ? 'border-red-400' : undefined}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => setMode('idle')}>
                    Quay lại
                  </Button>
                  <Button variant="danger" loading={rejecting} disabled={busy || !reason.trim()} onClick={submitReject}>
                    <X className="size-4" /> Xác nhận từ chối
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Từ chối chuyển hồ sơ sang REJECTED; gia sư phải sửa rồi nộp lại mới xuất hiện lại ở hàng đợi này.
                </p>
              </div>
            )}
          </footer>
        )}
      </aside>
    </div>
  )
}

function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{children}</dd>
    </div>
  )
}

const DOC_DECISION: Record<'APPROVED' | 'REJECTED', string> = {
  APPROVED: 'Chấp thuận (APPROVED)',
  REJECTED: 'Bác bỏ (REJECTED)',
}

function DocumentReviewCard() {
  const queryClient = useQueryClient()
  const [documentId, setDocumentId] = useState('')
  const [status, setStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => reviewDocument(Number(documentId), { status, reason: reason.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tutors'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setDocumentId('')
      setReason('')
      toast.success('Đã ghi quyết định cho giấy tờ.')
    },
  })

  function submit() {
    const id = Number(documentId)
    if (!documentId.trim() || !Number.isInteger(id) || id <= 0) {
      setError('Cần ID giấy tờ hợp lệ (số nguyên dương).')
      return
    }
    const trimmed = reason.trim()
    if (trimmed.length > REASON_MAX) {
      setError(`Lý do tối đa ${REASON_MAX} ký tự.`)
      return
    }
    if (status === 'REJECTED' && !trimmed) {
      setError('Khi bác giấy tờ bắt buộc có lý do (backend: REJECT_REASON_REQUIRED).')
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <Card title="Duyệt giấy tờ theo ID">
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Backend có POST /admin/documents/{'{id}'}/review nhưng không có endpoint liệt kê giấy tờ cho admin
          (GET /admin/documents không tồn tại; /tutors/me/documents chỉ chính gia sư đó gọi được), nên form này cần ID
          giấy tờ do gia sư cung cấp. Quyết định Duyệt/Từ chối trong hàng đợi ở trên áp dụng cho toàn bộ hồ sơ.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="ID giấy tờ"
            inputMode="numeric"
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            placeholder="vd: 42"
          />
          <Select label="Quyết định" value={status} onChange={(event) => setStatus(event.target.value as 'APPROVED' | 'REJECTED')}>
            <option value="APPROVED">{DOC_DECISION.APPROVED}</option>
            <option value="REJECTED">{DOC_DECISION.REJECTED}</option>
          </Select>
          <div className="flex items-end">
            <Button loading={mutation.isPending} onClick={submit}>
              <Check className="size-4" /> Ghi quyết định
            </Button>
          </div>
        </div>
        <Textarea
          label={status === 'REJECTED' ? 'Lý do (bắt buộc)' : 'Ghi chú (không bắt buộc)'}
          value={reason}
          maxLength={REASON_MAX}
          onChange={(event) => setReason(event.target.value)}
          hint={error ?? `Tối đa ${REASON_MAX} ký tự · lý do được gửi cho gia sư qua thông báo`}
          className={error ? 'border-red-400' : undefined}
        />
        <p className="text-xs text-slate-500">
          Chỉ giấy tờ đang PENDING mới có thể duyệt; giấy tờ đã có kết quả sẽ trả NOT_FOUND “Pending document not found”.
        </p>
      </div>
    </Card>
  )
}
