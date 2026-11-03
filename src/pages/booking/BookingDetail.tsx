import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { fetchBooking } from '../../api/booking'
import type { Booking } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { SESSION_MODE_LABEL, BOOKING_STATUS_LABEL, STATUS_TONE } from '../../lib/labels'
import { durationMinutes, formatDateTime, formatVnd } from '../../lib/format'
import { Badge } from '../../components/ui'
import { otherPartyPhone, phoneHiddenHint, timeRange, useChildNames, useSubjectNames } from './bookingLogic'

export default function BookingDetail({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { user } = useAuth()
  const role = user?.role ?? 'PARENT'
  const detailQuery = useQuery({ queryKey: ['booking', booking.id], queryFn: () => fetchBooking(booking.id) })
  const subjectNames = useSubjectNames()
  const childNames = useChildNames(role === 'PARENT')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const data = detailQuery.data ?? booking
  const phone = otherPartyPhone(data, role)
  const subjectName = subjectNames.get(data.subjectId) ?? `Môn #${data.subjectId}`
  const childName = data.childId != null ? childNames.get(data.childId) : undefined

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose} role="presentation">
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Chi tiết buổi học ${booking.id}`}
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Buổi học #{booking.id}</h2>
            <Badge tone={STATUS_TONE[data.status]}>{BOOKING_STATUS_LABEL[data.status]}</Badge>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
            <X className="size-5" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 text-sm">
          <section className="space-y-1">
            <Field label={role === 'TUTOR' ? 'Phụ huynh' : 'Gia sư'}>
              {role === 'TUTOR' ? (
                <>Phụ huynh #{data.parentId}</>
              ) : (
                <Link to={`/tutors/${data.tutorId}`} className="font-medium text-brand-600 hover:underline">
                  Gia sư #{data.tutorId}
                </Link>
              )}
            </Field>
            {childName && <Field label="Học sinh">{childName}</Field>}
            <Field label="Môn học">{subjectName}</Field>
          </section>

          <section className="space-y-1">
            <Field label="Thời gian">{formatDateTime(data.startAt)}</Field>
            <p className="text-slate-500">
              {timeRange(data)} · {durationMinutes(data.startAt, data.endAt)} phút
            </p>
            <Field label="Hình thức">
              {SESSION_MODE_LABEL[data.mode]}
              {data.mode === 'AT_HOME' && data.location ? ` — ${data.location}` : ''}
            </Field>
            {data.mode === 'ONLINE' && data.meetingUrl && (
              <Field label="Link buổi học">
                <a href={data.meetingUrl} target="_blank" rel="noreferrer" className="break-all text-brand-600 hover:underline">
                  {data.meetingUrl}
                </a>
              </Field>
            )}
            <Field label="Học phí">{formatVnd(data.price)}</Field>
            {data.isTrial && <p className="text-xs text-slate-500">Đây là buổi học thử.</p>}
          </section>

          <section className="space-y-1 border-t border-slate-100 pt-4">
            <Field label="Điện thoại liên hệ">
              {phone ? (
                <a href={`tel:${phone}`} className="font-medium text-brand-600 hover:underline">
                  {phone}
                </a>
              ) : (
                <span className="italic text-slate-500">{phoneHiddenHint(role)}</span>
              )}
            </Field>
          </section>

          {data.status === 'CANCELLED' && (
            <section className="space-y-1 rounded-lg bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Thông tin hủy</p>
              <Field label="Lý do">{data.cancelReason || 'Không nêu lý do'}</Field>
            </section>
          )}

          {data.status === 'NO_SHOW' && (
            <p className="rounded-lg bg-slate-50 p-4 text-slate-500">Gia sư ghi nhận buổi vắng mặt.</p>
          )}

          {detailQuery.isLoading && <p className="text-xs text-slate-400">Đang cập nhật thông tin buổi học…</p>}
        </div>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap gap-x-2">
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-slate-800">{children}</span>
    </p>
  )
}
