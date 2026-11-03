import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Send, Trash2, Upload } from 'lucide-react'
import {
  deleteDocument,
  fetchDocuments,
  fetchMySubjects,
  fetchMyTutorProfile,
  submitForReview,
  uploadDocument,
} from '../../../api/tutor'
import type { DocumentType, TutorDocument } from '../../../api/types'
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL, STATUS_TONE } from '../../../lib/labels'
import { formatDate } from '../../../lib/format'
import { Badge, Button, Card, EmptyState, Select, Spinner } from '../../../components/ui'

const DOC_TYPES = Object.keys(DOC_TYPE_LABEL) as DocumentType[]
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const MAX_BYTES = 5 * 1024 * 1024

/** Backend chặn MIME/dung lượng; kiểm tra trước để báo lỗi rõ ràng thay vì ăn 400/415. */
function fileProblem(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Định dạng “${file.type || 'không xác định'}” không được chấp nhận. Chỉ nhận PDF, PNG, JPG.`
  }
  if (file.size > MAX_BYTES) {
    return `Tệp lớn ${(file.size / 1024 / 1024).toFixed(1)} MB, vượt giới hạn 5 MB.`
  }
  return null
}

export default function DocumentsTab() {
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['tutor', 'me'], queryFn: fetchMyTutorProfile })
  const subjectsQuery = useQuery({ queryKey: ['tutor', 'me', 'subjects'], queryFn: fetchMySubjects })
  const docsQuery = useQuery({ queryKey: ['tutor', 'me', 'documents'], queryFn: fetchDocuments })

  const [docType, setDocType] = useState<DocumentType>('ID_CARD')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  /** đổi key để reset input[type=file] sau khi tải lên thành công */
  const [pickerKey, setPickerKey] = useState(0)

  const status = profileQuery.data?.verificationStatus
  const locked = status === 'PENDING'
  const editable = status === 'DRAFT' || status === 'REJECTED'
  const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['tutor', 'me'] })
    queryClient.invalidateQueries({ queryKey: ['tutor', 'me', 'documents'] })
    queryClient.invalidateQueries({ queryKey: ['tutor', 'me', 'subjects'] })
  }

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Hãy chọn tệp để tải lên.')
      return uploadDocument(file, docType)
    },
    onSuccess: () => {
      invalidateAll()
      setFile(null)
      setFileError(null)
      setPickerKey((k) => k + 1)
      toast.success('Đã tải giấy tờ lên. Chờ admin kiểm tra.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => deleteDocument(docId),
    onSuccess: () => {
      invalidateAll()
      toast.success('Đã xóa giấy tờ.')
    },
  })

  const submitMutation = useMutation({
    mutationFn: submitForReview,
    onSuccess: () => {
      invalidateAll()
      toast.success('Đã nộp hồ sơ. Admin sẽ xem xét trong 24–48 giờ.')
    },
  })

  const profile = profileQuery.data
  const subjectsCount = subjectsQuery.data?.length ?? 0

  const checklist = useMemo(
    () => [
      { label: 'Tiêu đề hồ sơ', ok: !!profile?.headline?.trim() },
      { label: 'Giới thiệu bản thân', ok: !!profile?.bio?.trim() },
      { label: 'Trình độ học vấn', ok: !!profile?.educationLevel },
      { label: 'Trường / nơi công tác', ok: !!profile?.school?.trim() },
      { label: 'Học phí mỗi giờ lớn hơn 0', ok: (profile?.hourlyRate ?? 0) > 0 },
      { label: 'Hình thức dạy', ok: !!profile?.teachingMode },
      { label: 'Ít nhất một môn dạy', ok: subjectsCount > 0 },
      { label: 'Ít nhất một giấy tờ CCCD/CMND', ok: docs.some((d) => d.type === 'ID_CARD') },
    ],
    [profile, subjectsCount, docs],
  )

  const missing = checklist.filter((item) => !item.ok)

  if (profileQuery.isLoading || docsQuery.isLoading) return <Spinner />

  function pickFile(selected: File | null) {
    setFile(selected)
    setFileError(selected ? fileProblem(selected) : null)
  }

  return (
    <div className="space-y-6">
      <Card title="Tải giấy tờ lên">
        {!editable && !locked && (
          <p className="mb-4 text-sm text-slate-500">Hồ sơ đã xác minh — vui lòng liên hệ admin nếu cần thay giấy tờ.</p>
        )}
        {locked && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Hồ sơ đang chờ duyệt nên tạm khóa.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Chọn tệp (PDF, PNG hoặc JPG, tối đa 5 MB)</span>
              <input
                key={pickerKey}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={locked || uploadMutation.isPending}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Select label="Loại giấy tờ" className="w-60" value={docType} disabled={locked} onChange={(e) => setDocType(e.target.value as DocumentType)}>
            {DOC_TYPES.map((type) => (
              <option key={type} value={type}>{DOC_TYPE_LABEL[type]}</option>
            ))}
          </Select>
          <Button loading={uploadMutation.isPending} disabled={locked || !file || !!fileError} onClick={() => uploadMutation.mutate()}>
            <Upload className="size-4" /> Tải lên
          </Button>
        </div>
        {fileError && <p className="mt-3 text-sm text-red-600">{fileError}</p>}
        <p className="mt-3 text-xs text-slate-500">
          CCCD/CMND là bắt buộc. Bằng cấp, thẻ sinh viên và chứng chỉ là tùy chọn nhưng giúp hồ sơ thuyết phục hơn.
        </p>
      </Card>

      <Card title="Giấy tờ của tôi">
        {docs.length === 0 ? (
          <EmptyState>Chưa có giấy tờ nào. Hãy tải CCCD/CMND lên để đáp ứng điều kiện nộp hồ sơ.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                canDelete={editable}
                deleting={deleteMutation.isPending && deleteMutation.variables === doc.id}
                onDelete={() => deleteMutation.mutate(doc.id)}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Nộp hồ sơ duyệt">
        {locked || status === 'VERIFIED' ? (
          <p className="text-sm text-slate-500">
            {status === 'VERIFIED' ? 'Hồ sơ đã được duyệt và công khai với phụ huynh.' : 'Hồ sơ đang chờ admin duyệt.'}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Hồ sơ cần đáp ứng đủ các điều kiện sau trước khi nộp:</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  {item.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 text-red-500" />
                  )}
                  <span className={item.ok ? 'text-slate-600' : 'font-medium text-red-600'}>{item.label}</span>
                </li>
              ))}
            </ul>
            {missing.length > 0 && (
              <p className="text-sm text-red-600">
                Còn thiếu: {missing.map((m) => m.label).join(', ')}.{' '}
                <button type="button" className="font-medium text-brand-600 underline-offset-2 hover:underline" onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}>
                  Tải giấy tờ ở phía trên
                </button>
              </p>
            )}
            <Button loading={submitMutation.isPending} disabled={missing.length > 0} onClick={() => submitMutation.mutate()}>
              <Send className="size-4" /> Nộp hồ sơ duyệt
            </Button>
            <p className="text-xs text-slate-500">
              Nộp lại chỉ áp dụng khi hồ sơ ở trạng thái bản nháp hoặc bị từ chối.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

function DocumentRow({ doc, canDelete, deleting, onDelete }: { doc: TutorDocument; canDelete: boolean; deleting: boolean; onDelete: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <FileText className="size-5 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{DOC_TYPE_LABEL[doc.type] ?? `Giấy tờ #${doc.id}`}</p>
        <p className="mt-0.5 text-xs text-slate-400">Tải lên {formatDate(doc.createdAt)}</p>
      </div>
      <Badge tone={STATUS_TONE[doc.status]}>{DOC_STATUS_LABEL[doc.status]}</Badge>
      {doc.url && (
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          <ExternalLink className="size-4" /> Mở tài liệu
        </a>
      )}
      <Button variant="ghost" onClick={onDelete} disabled={!canDelete} loading={deleting}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}
