import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Save, Trash2 } from 'lucide-react'
import { fetchMyAvailability, fetchMyTutorProfile, updateMyAvailability } from '../../../api/tutor'
import { DAY_LABELS } from '../../../lib/labels'
import { Button, Card, Spinner } from '../../../components/ui'

interface Slot {
  startTime: string
  endTime: string
}

const EMPTY_DAY = (): Slot => ({ startTime: '', endTime: '' })
const emptyWeek = (): Slot[][] => DAY_LABELS.map(() => [])

const TIME_RE = /^\d{2}:\d{2}$/

/** Backend lưu kiểu TIME và có thể trả "HH:mm:ss" — chuẩn hoá về "HH:mm" cho input[type=time]. */
function hhmm(value: string): string {
  return value.slice(0, 5)
}

function toMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
}

/** dayOfWeek 1..7 (ISO, Thứ Hai = 1); PUT thay toàn bộ lịch nên chỉ gửi mảng trần. */
function validateWeek(days: Slot[][]): string[] {
  const errors: string[] = []
  days.forEach((list, i) => {
    const day = DAY_LABELS[i]
    const complete: Slot[] = []
    for (const s of list) {
      if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) {
        errors.push(`${day}: giờ phải ở định dạng HH:mm (ví dụ 09:30).`)
      } else if (toMinutes(s.endTime) <= toMinutes(s.startTime)) {
        errors.push(`${day}: giờ kết thúc phải sau giờ bắt đầu.`)
      } else {
        complete.push(s)
      }
    }
    const sorted = [...complete].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    for (let k = 1; k < sorted.length; k++) {
      if (toMinutes(sorted[k].startTime) < toMinutes(sorted[k - 1].endTime)) {
        errors.push(`${day}: có khung giờ chồng lấn nhau.`)
        break
      }
    }
  })
  return [...new Set(errors)]
}

export default function AvailabilityTab() {
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['tutor', 'me'], queryFn: fetchMyTutorProfile })
  const slotsQuery = useQuery({ queryKey: ['tutor', 'me', 'availability'], queryFn: fetchMyAvailability })

  const profile = profileQuery.data
  const locked = profile?.verificationStatus === 'PENDING'
  const [days, setDays] = useState<Slot[][]>(emptyWeek)

  useEffect(() => {
    if (!slotsQuery.data) return
    const next = emptyWeek()
    for (const slot of slotsQuery.data) {
      const idx = slot.dayOfWeek - 1
      if (idx >= 0 && idx < 7) next[idx].push({ startTime: hhmm(slot.startTime), endTime: hhmm(slot.endTime) })
    }
    setDays(next)
  }, [slotsQuery.data])

  const flat = useMemo(
    () => days.flatMap((list, i) => list.map((s) => ({ dayOfWeek: i + 1, startTime: s.startTime, endTime: s.endTime }))),
    [days],
  )
  const errors = useMemo(() => validateWeek(days), [days])
  const totals = useMemo(() => {
    const minutes = flat.reduce((sum, s) => sum + Math.max(0, toMinutes(s.endTime) - toMinutes(s.startTime)), 0)
    return { count: flat.length, hours: Math.round((minutes / 60) * 10) / 10 }
  }, [flat])

  const mutation = useMutation({
    mutationFn: () => updateMyAvailability(flat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutor', 'me', 'availability'] })
      queryClient.invalidateQueries({ queryKey: ['tutor', 'me'] })
      if (profile) queryClient.invalidateQueries({ queryKey: ['tutor', profile.userId] })
      toast.success('Đã lưu lịch rảnh.')
    },
  })

  function patchSlot(dayIdx: number, slotIdx: number, patch: Partial<Slot>) {
    setDays((prev) => prev.map((list, i) => (i === dayIdx ? list.map((s, k) => (k === slotIdx ? { ...s, ...patch } : s)) : list)))
  }

  function addSlot(dayIdx: number) {
    setDays((prev) => prev.map((list, i) => (i === dayIdx ? [...list, EMPTY_DAY()] : list)))
  }

  function removeSlot(dayIdx: number, slotIdx: number) {
    setDays((prev) => prev.map((list, i) => (i === dayIdx ? list.filter((_, k) => k !== slotIdx) : list)))
  }

  if (slotsQuery.isLoading) return <Spinner />

  return (
    <Card title="Lịch rảnh trong tuần">
      {locked && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Hồ sơ đang chờ duyệt nên lịch rảnh tạm bị khóa.
        </p>
      )}

      <div className="space-y-3">
        {DAY_LABELS.map((label, dayIdx) => {
          const list = days[dayIdx] ?? []
          return (
            <div key={label} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                <Button variant="ghost" onClick={() => addSlot(dayIdx)} disabled={locked}>
                  <Plus className="size-4" /> Thêm khung giờ
                </Button>
              </div>
              {list.length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">Chưa có khung giờ.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap items-center gap-2">
                  {list.map((slot, slotIdx) => (
                    <li key={slotIdx} className="flex items-center gap-2">
                      <input
                        aria-label={`${label}: giờ bắt đầu`}
                        type="time"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                        value={slot.startTime}
                        disabled={locked}
                        onChange={(e) => patchSlot(dayIdx, slotIdx, { startTime: e.target.value })}
                      />
                      <span className="text-slate-400">→</span>
                      <input
                        aria-label={`${label}: giờ kết thúc`}
                        type="time"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                        value={slot.endTime}
                        disabled={locked}
                        onChange={(e) => patchSlot(dayIdx, slotIdx, { endTime: e.target.value })}
                      />
                      <Button variant="ghost" onClick={() => removeSlot(dayIdx, slotIdx)} disabled={locked}>
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {errors.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {totals.count === 0
            ? 'Chưa có khung giờ nào — phụ huynh sẽ không thấy lịch trống của bạn.'
            : `${totals.count} khung giờ · ≈ ${totals.hours} giờ mỗi tuần. Lịch lặp lại hằng tuần.`}
        </p>
        <Button loading={mutation.isPending} disabled={locked || errors.length > 0} onClick={() => mutation.mutate()}>
          <Save className="size-4" /> Lưu lịch rảnh
        </Button>
      </div>
    </Card>
  )
}
