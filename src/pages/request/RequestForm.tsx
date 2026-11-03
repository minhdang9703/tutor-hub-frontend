import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Eraser, Save, X } from 'lucide-react'
import { SESSION_MODE_LABEL } from '../../lib/labels'
import type { SessionMode, TutorRequest, TutorRequestInput } from '../../api/types'
import { Button, Card, Input, Select, Textarea } from '../../components/ui'
import {
  DESCRIPTION_MAX,
  EXPIRY_PRESET_DAYS,
  GRADES,
  MODE_VALUES,
  RATE_STEP,
  SCHEDULE_NOTE_MAX,
  SESSIONS_MAX,
  SESSIONS_MIN,
  budgetLabel,
  countErrors,
  describeRequestError,
  emptyRequestDraft,
  expiryPresetValue,
  requestDraftFromRequest,
  requestDraftToInput,
  useChildDirectory,
  useRequestCatalog,
  useSaveRequest,
  validateRequestDraft,
  wholeNumberOrNull,
  type RequestDraft,
  type RequestErrors,
  type RequestField,
} from './requestLogic'

export interface RequestFormProps {
  /** null/undefined = tạo mới; có yêu cầu = sửa (backend dùng PATCH theo hướng thay thế toàn bộ). */
  request?: TutorRequest | null
  onCancel: () => void
  onSaved?: (request: TutorRequest) => void
}

function FieldError({ field, errors }: { field: RequestField; errors: RequestErrors }) {
  const message = errors[field]
  if (!message) return null
  return <p className="text-xs font-medium text-red-600">{message}</p>
}

export default function RequestForm({ request, onCancel, onSaved }: RequestFormProps) {
  const catalog = useRequestCatalog()
  const childDirectory = useChildDirectory(true)
  const [draft, setDraft] = useState<RequestDraft>(() => (request ? requestDraftFromRequest(request) : emptyRequestDraft()))
  const [showErrors, setShowErrors] = useState(false)

  const errors = useMemo(() => validateRequestDraft(draft), [draft])
  const visibleErrors: RequestErrors = showErrors ? errors : {}
  const errorCount = countErrors(errors)

  const mutation = useSaveRequest((saved) => onSaved?.(saved))

  function patch(next: Partial<RequestDraft>) {
    setDraft((prev) => ({ ...prev, ...next }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setShowErrors(true)
    if (countErrors(validateRequestDraft(draft)) > 0) return
    // PATCH thay thế bản ghi nên payload luôn mang mọi trường, kể cả field vừa được xóa.
    const input: TutorRequestInput = requestDraftToInput(draft)
    mutation.mutate({ requestId: request?.id, input })
  }

  const budgetPreview = budgetLabel(wholeNumberOrNull(draft.budgetMin), wholeNumberOrNull(draft.budgetMax))
  const expiryValue = draft.expiresAt

  return (
    <Card
      title={request ? `Sửa yêu cầu #${request.id}` : 'Tạo yêu cầu tìm gia sư'}
      actions={
        <Button type="button" variant="ghost" className="px-2.5 py-1.5" onClick={onCancel}>
          <X className="size-4" /> Đóng
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Select
              label="Môn học"
              required
              value={draft.subjectId}
              disabled={mutation.isPending}
              onChange={(e) => patch({ subjectId: e.target.value })}
              hint={catalog.isLoading ? 'Đang tải danh mục môn học…' : undefined}
            >
              <option value="">Chọn môn học</option>
              {catalog.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
            <FieldError field="subjectId" errors={visibleErrors} />
          </div>

          <div>
            <Select
              label="Khối lớp"
              required
              value={draft.grade}
              disabled={mutation.isPending}
              onChange={(e) => patch({ grade: e.target.value })}
              hint="Backend chỉ nhận lớp 1–12."
            >
              <option value="">Chọn khối lớp</option>
              {GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  Lớp {grade}
                </option>
              ))}
            </Select>
            <FieldError field="grade" errors={visibleErrors} />
          </div>

          <div>
            <Select
              label="Hình thức dạy"
              required
              value={draft.mode}
              disabled={mutation.isPending}
              onChange={(e) => patch({ mode: e.target.value as SessionMode })}
            >
              {MODE_VALUES.map((mode) => (
                <option key={mode} value={mode}>
                  {SESSION_MODE_LABEL[mode]}
                </option>
              ))}
            </Select>
            <FieldError field="mode" errors={visibleErrors} />
          </div>

          <div>
            <Select
              label="Quận / huyện (không bắt buộc)"
              value={draft.districtId}
              disabled={mutation.isPending}
              onChange={(e) => patch({ districtId: e.target.value })}
              hint={draft.mode === 'ONLINE' ? 'Bỏ trống nếu chỉ học online.' : 'Gia sư khu vực này dễ thấy yêu cầu hơn.'}
            >
              <option value="">Toàn quốc</option>
              {catalog.cities.map((city) => (
                <optgroup key={city} label={city}>
                  {catalog.districts
                    .filter((district) => district.city === city)
                    .map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
            <FieldError field="districtId" errors={visibleErrors} />
          </div>

          <div>
            <Select
              label="Con (không bắt buộc)"
              value={draft.childId}
              disabled={mutation.isPending}
              onChange={(e) => patch({ childId: e.target.value })}
              hint={
                childDirectory.children.length === 0
                  ? 'Hồ sơ chưa có con — thêm con trong hồ sơ phụ huynh để gắn yêu cầu.'
                  : undefined
              }
            >
              <option value="">Chưa chọn</option>
              {childDirectory.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} · Lớp {child.grade}
                </option>
              ))}
            </Select>
            <FieldError field="childId" errors={visibleErrors} />
            {childDirectory.children.length === 0 && (
              <Link to="/parent" className="text-xs font-medium text-brand-600 hover:underline">
                Thêm thông tin con
              </Link>
            )}
          </div>

          <div>
            <Input
              label="Số buổi mỗi tuần (không bắt buộc)"
              type="number"
              min={SESSIONS_MIN}
              max={SESSIONS_MAX}
              step={1}
              inputMode="numeric"
              placeholder="VD: 2"
              value={draft.sessionsPerWeek}
              disabled={mutation.isPending}
              onChange={(e) => patch({ sessionsPerWeek: e.target.value })}
              hint={`Từ ${SESSIONS_MIN} đến ${SESSIONS_MAX} buổi.`}
            />
            <FieldError field="sessionsPerWeek" errors={visibleErrors} />
          </div>

          <div>
            <Input
              label="Ngân sách tối thiểu (VND/buổi)"
              type="number"
              min={0}
              step={RATE_STEP}
              inputMode="numeric"
              placeholder="VD: 150000"
              value={draft.budgetMin}
              disabled={mutation.isPending}
              onChange={(e) => patch({ budgetMin: e.target.value })}
            />
            <FieldError field="budgetMin" errors={visibleErrors} />
          </div>

          <div>
            <Input
              label="Ngân sách tối đa (VND/buổi)"
              type="number"
              min={0}
              step={RATE_STEP}
              inputMode="numeric"
              placeholder="VD: 250000"
              value={draft.budgetMax}
              disabled={mutation.isPending}
              onChange={(e) => patch({ budgetMax: e.target.value })}
              hint={`Xem trước: ${budgetPreview}`}
            />
            <FieldError field="budgetMax" errors={visibleErrors} />
          </div>
        </div>

        <div>
          <Textarea
            label="Ghi chú về lịch học (không bắt buộc)"
            placeholder="VD: Ưu tiên chiều thứ 7 và chủ nhật, nghỉ lễ theo lịch trường."
            value={draft.scheduleNote}
            maxLength={SCHEDULE_NOTE_MAX}
            rows={2}
            disabled={mutation.isPending}
            onChange={(e) => patch({ scheduleNote: e.target.value })}
            hint={`${draft.scheduleNote.length}/${SCHEDULE_NOTE_MAX} ký tự`}
          />
          <FieldError field="scheduleNote" errors={visibleErrors} />
        </div>

        <div>
          <Textarea
            label="Mô tả chi tiết (không bắt buộc)"
            placeholder="Mục tiêu học, điểm yếu cần bổ trợ, yêu cầu với gia sư…"
            value={draft.description}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            disabled={mutation.isPending}
            onChange={(e) => patch({ description: e.target.value })}
            hint={`${draft.description.length.toLocaleString('vi-VN')}/${DESCRIPTION_MAX.toLocaleString('vi-VN')} ký tự`}
          />
          <FieldError field="description" errors={visibleErrors} />
        </div>

        <div>
          <Input
            label="Hạn nhận đơn (không bắt buộc)"
            type="datetime-local"
            value={expiryValue}
            disabled={mutation.isPending}
            onChange={(e) => patch({ expiresAt: e.target.value })}
            hint="Bỏ trống = yêu cầu không tự hết hạn. Backend từ chối ngày ở quá khứ."
          />
          <FieldError field="expiresAt" errors={visibleErrors} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {EXPIRY_PRESET_DAYS.map((days) => (
              <Button
                key={days}
                type="button"
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                onClick={() => patch({ expiresAt: expiryPresetValue(days) })}
              >
                <CalendarClock className="size-3.5" /> Sau {days} ngày
              </Button>
            ))}
            {expiryValue !== '' && (
              <Button
                type="button"
                variant="ghost"
                className="px-2.5 py-1 text-xs"
                onClick={() => patch({ expiresAt: '' })}
              >
                <Eraser className="size-3.5" /> Bỏ hạn
              </Button>
            )}
          </div>
        </div>

        {showErrors && errorCount > 0 && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            còn {errorCount} trường chưa hợp lệ — xem thông báo đỏ bên dưới từng ô.
          </p>
        )}
        {mutation.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {describeRequestError(mutation.error)}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            <Save className="size-4" />
            {request ? 'Lưu thay đổi' : 'Đăng yêu cầu'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
