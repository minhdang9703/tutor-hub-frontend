import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarPlus } from 'lucide-react'
import { createBooking } from '../../api/booking'
import { fetchTutor } from '../../api/tutor'
import { fetchChildren } from '../../api/parent'
import type { BookingInput, SessionMode, TeachingMode } from '../../api/types'
import { SESSION_MODE_LABEL } from '../../lib/labels'
import { formatVnd } from '../../lib/format'
import { Button, Input, Select, Spinner } from '../../components/ui'
import { invalidateBooking } from './bookingLogic'

const TIME_RE = /^\d{1,2}:\d{2}$/
const TEXT_MAX = 255

interface Props {
  tutorId: number
  date: string
  /** "HH:mm" từ khung giờ trống đã chọn ở trang hồ sơ gia sư. */
  start?: string
  end?: string
  onClose: () => void
}

function defaultMode(teachingMode: TeachingMode): SessionMode {
  return teachingMode === 'AT_HOME' ? 'AT_HOME' : 'ONLINE'
}

function toIso(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(`${date}T00:00:00`)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.toISOString()
}

export default function NewBookingDialog({ tutorId, date, start, end, onClose }: Props) {
  const queryClient = useQueryClient()
  const [pickedDate, setPickedDate] = useState(date)
  const [startTime, setStartTime] = useState(start ?? '19:00')
  const [endTime, setEndTime] = useState(end ?? '20:00')
  const [subjectId, setSubjectId] = useState('')
  const [childId, setChildId] = useState('')
  const [mode, setMode] = useState<SessionMode>('ONLINE')
  const [modeTouched, setModeTouched] = useState(false)
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [isTrial, setIsTrial] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const tutorQuery = useQuery({
    queryKey: ['tutor', tutorId],
    queryFn: () => fetchTutor(tutorId),
    enabled: Number.isFinite(tutorId),
  })
  const childrenQuery = useQuery({ queryKey: ['parent', 'children'], queryFn: fetchChildren })

  const tutor = tutorQuery.data ?? null
  const subjects = tutor?.subjects ?? []
  const subjectValue = subjectId || (subjects.length === 1 ? String(subjects[0].subjectId) : '')
  const effectiveMode = modeTouched ? mode : tutor ? defaultMode(tutor.teachingMode) : 'ONLINE'

  const minutes = useMemo(() => {
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) return NaN
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    return (eh * 60 + em) - (sh * 60 + sm)
  }, [startTime, endTime])

  const autoPrice = tutor && Number.isFinite(minutes) && minutes > 0 ? Math.round((tutor.hourlyRate * minutes) / 60) : null
  const priceValue = priceTouched ? price : autoPrice != null ? String(autoPrice) : ''
  const priceNumber = Number(priceValue)

  const startAt = TIME_RE.test(startTime) && /^\d{4}-\d{2}-\d{2}$/.test(pickedDate) ? toIso(pickedDate, startTime) : ''

  const errors = useMemo(() => {
    const list: string[] = []
    if (!subjectValue) list.push('Chọn môn học.')
    if (!Number.isFinite(minutes) || minutes <= 0) list.push('Giờ kết thúc phải sau giờ bắt đầu.')
    if (startAt === '' || new Date(startAt).getTime() <= Date.now()) list.push('Buổi học phải diễn ra trong tương lai.')
    if (!Number.isFinite(priceNumber) || priceNumber < 0) list.push('Đơn giá phải là số VNĐ từ 0 trở lên.')
    if (location.length > TEXT_MAX) list.push(`Địa chỉ tối đa ${TEXT_MAX} ký tự.`)
    if (meetingUrl.length > TEXT_MAX) list.push(`Link học tối đa ${TEXT_MAX} ký tự.`)
    return list
  }, [subjectValue, minutes, startAt, priceNumber, location.length, meetingUrl.length])

  const payload: BookingInput | null =
    tutor && errors.length === 0
      ? {
          tutorId: tutor.id,
          childId: childId ? Number(childId) : undefined,
          subjectId: Number(subjectValue),
          startAt,
          endAt: toIso(pickedDate, endTime),
          mode: effectiveMode,
          location: effectiveMode === 'AT_HOME' && location.trim() !== '' ? location.trim() : undefined,
          meetingUrl: effectiveMode === 'ONLINE' && meetingUrl.trim() !== '' ? meetingUrl.trim() : undefined,
          price: Math.round(priceNumber),
          isTrial,
        }
      : null

  const mutation = useMutation({
    mutationFn: () => {
      if (!payload) throw new Error('Hãy điền đủ thông tin trước khi đặt lịch')
      return createBooking(payload)
    },
    onSuccess: () => {
      invalidateBooking(queryClient)
      toast.success('Đã gửi yêu cầu đặt lịch. Gia sư sẽ xác nhận trước buổi học.')
      onClose()
    },
    // MutationErrorToaster toàn cục lo phần toast lỗi; khai báo onError ở đây sẽ nhân đôi toast.
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <CalendarPlus className="size-5 text-brand-600" /> Đặt một buổi học
        </h2>

        {tutorQuery.isLoading ? (
          <Spinner />
        ) : tutorQuery.isError || !tutor ? (
          <p className="mt-2 text-sm text-slate-600">
            Không tải được hồ sơ gia sư #{tutorId}. Gia sư chưa được xác minh hoặc đường dẫn đặt lịch không còn hợp lệ.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              {tutor.fullName} · {formatVnd(tutor.hourlyRate)}/giờ. Yêu cầu cần gia sư xác nhận nên chưa khoá lịch ngay.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setShowErrors(true)
                if (payload) mutation.mutate()
              }}
              className="mt-5 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Ngày học"
                  type="date"
                  value={pickedDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setPickedDate(e.target.value || date)}
                />

                <Select
                  label="Môn học"
                  value={subjectValue}
                  onChange={(e) => setSubjectId(e.target.value)}
                  hint={subjects.length > 0 ? `${subjects.length} môn gia sư dạy` : 'Gia sư chưa cập nhật môn dạy'}
                >
                  <option value="">— Chọn môn —</option>
                  {subjects.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {s.name} · Lớp {s.gradeFrom === s.gradeTo ? s.gradeFrom : `${s.gradeFrom}–${s.gradeTo}`}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Giờ bắt đầu"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  hint={Number.isFinite(minutes) && minutes > 0 ? `Thời lượng ${minutes} phút` : 'Chọn giờ kết thúc sau giờ bắt đầu'}
                />

                <Input label="Giờ kết thúc" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />

                <Select
                  label="Con"
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  hint={childrenQuery.data?.length ? undefined : 'Thêm con trong hồ sơ phụ huynh để chọn'}
                >
                  <option value="">— Chưa chọn —</option>
                  {(childrenQuery.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} (lớp {c.grade})</option>
                  ))}
                </Select>

                <Select
                  label="Hình thức"
                  value={effectiveMode}
                  onChange={(e) => {
                    setMode(e.target.value as SessionMode)
                    setModeTouched(true)
                  }}
                >
                  {(['ONLINE', 'AT_HOME'] as SessionMode[]).map((m) => (
                    <option key={m} value={m}>{SESSION_MODE_LABEL[m]}</option>
                  ))}
                </Select>

                <Input
                  label="Đơn giá buổi học (VNĐ)"
                  type="number"
                  min={0}
                  step={1000}
                  value={priceValue}
                  onChange={(e) => {
                    setPrice(e.target.value)
                    setPriceTouched(true)
                  }}
                  hint={autoPrice != null ? `Tính theo học phí: ${formatVnd(autoPrice)}` : 'Nhập đơn giá thống nhất với gia sư'}
                />

                {effectiveMode === 'ONLINE' ? (
                  <Input
                    label="Link học (tuỳ chọn)"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    maxLength={TEXT_MAX}
                  />
                ) : (
                  <Input
                    label="Địa chỉ học (tuỳ chọn)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Số nhà, đường, quận/huyện"
                    maxLength={TEXT_MAX}
                  />
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={isTrial} onChange={(e) => setIsTrial(e.target.checked)} className="size-4 rounded border-slate-300" />
                Đây là buổi học thử
              </label>

              {showErrors && errors.length > 0 && (
                <p className="text-sm text-red-600">{errors.join(' ')}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Hủy
                </Button>
                <Button type="submit" loading={mutation.isPending} disabled={payload == null}>
                  Gửi yêu cầu đặt lịch
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
