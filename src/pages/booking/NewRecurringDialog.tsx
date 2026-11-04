import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Repeat } from 'lucide-react'
import { createRecurringBookings, type RecurringResult } from '../../api/booking'
import { fetchSubjects } from '../../api/catalog'
import { fetchChildren } from '../../api/parent'
import type { RecurringBookingInput, SessionMode, TutorCard } from '../../api/types'
import { SESSION_MODE_LABEL, DAY_LABELS } from '../../lib/labels'
import { formatVnd } from '../../lib/format'
import { Button, Input, Select } from '../../components/ui'
import { invalidateBooking } from './bookingLogic'
import TutorSearchSelect from './TutorSearchSelect'
import RecurringResultView from './RecurringResultView'

const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240]
const MIN_DURATION = 30
const MAX_DURATION = 240
const MIN_OCCURRENCES = 1
const MAX_OCCURRENCES = 52

interface Props {
  onClose: () => void
}

export default function NewRecurringDialog({ onClose }: Props) {
  const queryClient = useQueryClient()
  const [tutor, setTutor] = useState<TutorCard | null>(null)
  const [subjectId, setSubjectId] = useState('')
  const [childId, setChildId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(2)
  const [startTime, setStartTime] = useState('19:00')
  const [durationMin, setDurationMin] = useState(60)
  const [occurrences, setOccurrences] = useState(8)
  const [mode, setMode] = useState<SessionMode>('ONLINE')
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [result, setResult] = useState<{ result: RecurringResult; anchor: string } | null>(null)

  const subjectsQuery = useQuery({ queryKey: ['catalog', 'subjects'], queryFn: fetchSubjects })
  const childrenQuery = useQuery({ queryKey: ['parent', 'children'], queryFn: fetchChildren })

  const priceNumber = Number(price)
  const errors = useMemo(() => {
    const list: string[] = []
    if (!tutor) list.push('Chọn gia sư.')
    if (!subjectId) list.push('Chọn môn học.')
    if (!/^\d{1,2}:\d{2}$/.test(startTime)) list.push('Chọn giờ bắt đầu.')
    if (durationMin < MIN_DURATION || durationMin > MAX_DURATION) list.push(`Thời lượng phải từ ${MIN_DURATION} đến ${MAX_DURATION} phút.`)
    if (!Number.isInteger(occurrences) || occurrences < MIN_OCCURRENCES || occurrences > MAX_OCCURRENCES)
      list.push(`Số buổi phải là số nguyên từ ${MIN_OCCURRENCES} đến ${MAX_OCCURRENCES}.`)
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) list.push('Đơn giá phải là số VNĐ lớn hơn 0.')
    return list
  }, [tutor, subjectId, startTime, durationMin, occurrences, priceNumber])

  const anchor = useMemo(() => anchorStartIso(dayOfWeek, startTime), [dayOfWeek, startTime])
  const anchorEnd = useMemo(() => new Date(new Date(anchor).getTime() + durationMin * 60_000).toISOString(), [anchor, durationMin])

  const payload: RecurringBookingInput | null =
    tutor && errors.length === 0
      ? {
          booking: {
            tutorId: tutor.id,
            childId: childId ? Number(childId) : undefined,
            subjectId: Number(subjectId),
            startAt: anchor,
            endAt: anchorEnd,
            mode,
            price: Math.round(priceNumber),
          },
          occurrences,
        }
      : null

  const mutation = useMutation({
    mutationFn: () => {
      if (!payload) throw new Error('Hãy điền đủ thông tin trước khi tạo lịch')
      return createRecurringBookings(payload)
    },
    onSuccess: (res) => {
      setResult({ result: res, anchor })
      invalidateBooking(queryClient)
      if (res.created.length) toast.success(`Đã tạo ${res.created.length} buổi học.`)
      else toast('Không tạo được buổi nào vì gia sư đã kín lịch trong các tuần đó.')
    },
    // MutationErrorToaster toàn cục lo phần toast lỗi; khai báo onError ở đây sẽ nhân đôi toast.
  })

  function pickRate(nextTutor: TutorCard) {
    setTutor(nextTutor)
    if (!priceTouched) setPrice(String(Math.round((nextTutor.hourlyRate * durationMin) / 60)))
  }

  function changeDuration(value: number) {
    setDurationMin(value)
    if (tutor && !priceTouched) setPrice(String(Math.round((tutor.hourlyRate * value) / 60)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Repeat className="size-5 text-brand-600" /> Tạo lịch học lặp lại
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Mỗi tuần một buổi vào cùng thứ và giờ. Buổi nào trùng lịch gia sư sẽ được liệt kê riêng, các buổi còn lại
          vẫn tạo bình thường.
        </p>

        {result ? (
          <div className="mt-5">
            <RecurringResultView
              result={result.result}
              anchorStartAt={result.anchor}
              onReset={() => setResult(null)}
            />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
            className="mt-5 space-y-4"
          >
            <TutorSearchSelect
              selected={tutor}
              onPick={pickRate}
              onClear={() => {
                setTutor(null)
                setPriceTouched(false)
                setPrice('')
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Môn học" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">— Chọn môn —</option>
                {(subjectsQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>

              <Select
                label="Con"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                hint={childrenQuery.data?.length ? undefined : 'Thêm con trong hồ sơ phụ huynh để chọn'}
              >
                <option value="">— Chọn con —</option>
                {(childrenQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} (lớp {c.grade})</option>
                ))}
              </Select>

              <Select label="Thứ trong tuần" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                {DAY_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>{label}</option>
                ))}
              </Select>

              <Input
                label="Giờ bắt đầu"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                hint={`Buổi đầu tiên: ${new Date(anchor).toLocaleDateString('vi-VN')}`}
              />

              <Select
                label="Thời lượng"
                value={durationMin}
                onChange={(e) => changeDuration(Number(e.target.value))}
                hint={`${MIN_DURATION}–${MAX_DURATION} phút`}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{d} phút</option>
                ))}
              </Select>

              <Input
                label="Số buổi lặp lại"
                type="number"
                min={MIN_OCCURRENCES}
                max={MAX_OCCURRENCES}
                value={occurrences}
                onChange={(e) => setOccurrences(Number(e.target.value))}
                hint={`Mỗi tuần một buổi, tối đa ${MAX_OCCURRENCES} buổi`}
              />

              <Select
                label="Hình thức"
                value={mode}
                onChange={(e) => setMode(e.target.value as SessionMode)}
                hint="Địa chỉ hoặc link học bạn thống nhất với gia sư sau khi xác nhận."
              >
                {(['ONLINE', 'AT_HOME'] as SessionMode[]).map((m) => (
                  <option key={m} value={m}>{SESSION_MODE_LABEL[m]}</option>
                ))}
              </Select>

              <Input
                label="Đơn giá mỗi buổi (VNĐ)"
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value)
                  setPriceTouched(true)
                }}
                hint={tutor ? `Học phí gia sư: ${formatVnd(tutor.hourlyRate)}/giờ` : 'Chọn gia sư để gợi ý đơn giá'}
              />
            </div>

            {errors.length > 0 && <p className="text-sm text-slate-500">{errors.join(' ')}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" loading={mutation.isPending} disabled={!payload}>
                Tạo lịch học
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function nextDateForWeekday(dayOfWeek: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const today = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() + ((dayOfWeek - today + 7) % 7))
  return d
}

function anchorStartIso(dayOfWeek: number, startTime: string): string {
  const [h, m] = startTime.split(':').map(Number)
  const d = nextDateForWeekday(dayOfWeek)
  d.setHours(h || 0, m || 0, 0, 0)
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 7)
  return d.toISOString()
}
