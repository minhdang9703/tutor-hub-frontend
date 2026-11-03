import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Phone, Star, Video } from 'lucide-react'
import type { Booking, Role } from '../../api/types'
import { SESSION_MODE_LABEL, BOOKING_STATUS_LABEL, STATUS_TONE } from '../../lib/labels'
import { durationMinutes, formatDateTime, formatVnd } from '../../lib/format'
import { Badge, Button } from '../../components/ui'
import {
  ACTION_LABEL,
  CANCEL_MIN_HOURS,
  availableActions,
  canCancel,
  canReview,
  hoursUntilStart,
  otherPartyPhone,
  phoneHiddenHint,
  timeRange,
  useChildNames,
  useSubjectNames,
  type BookingAction,
} from './bookingLogic'

interface Props {
  booking: Booking
  role: Role
  pending: boolean
  onAction: (action: BookingAction, booking: Booking) => void
  onCancel: (booking: Booking) => void
  onReview: (booking: Booking) => void
  onOpen: (booking: Booking) => void
}

export default function BookingRowCard({ booking, role, pending, onAction, onCancel, onReview, onOpen }: Props) {
  const actions = availableActions(booking, role)
  const mayCancel = canCancel(booking, role)
  const mayReview = canReview(booking, role)
  const phone = otherPartyPhone(booking, role)
  const subjectNames = useSubjectNames()
  const childNames = useChildNames(role === 'PARENT')
  const place = booking.mode === 'ONLINE' ? booking.meetingUrl : booking.location
  const subjectName = subjectNames.get(booking.subjectId) ?? `Môn #${booking.subjectId}`
  const childName = booking.childId != null ? childNames.get(booking.childId) : undefined

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {role === 'PARENT' ? (
              <Link to={`/tutors/${booking.tutorId}`} className="font-semibold text-slate-900 hover:text-brand-700">
                Gia sư #{booking.tutorId}
              </Link>
            ) : (
              <h3 className="font-semibold text-slate-900">Phụ huynh #{booking.parentId}</h3>
            )}
            <Badge tone={STATUS_TONE[booking.status]}>{BOOKING_STATUS_LABEL[booking.status]}</Badge>
            {booking.isTrial && <Badge tone="blue">Buổi thử</Badge>}
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {subjectName}
            {childName && <span className="text-slate-500"> · Học sinh: {childName}</span>}
          </p>

          <p className="mt-2 text-sm font-medium text-slate-800">{formatDateTime(booking.startAt)}</p>
          <p className="text-xs text-slate-500">
            {timeRange(booking)} · {durationMinutes(booking.startAt, booking.endAt)} phút
          </p>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              {booking.mode === 'ONLINE' ? <Video className="size-4 text-slate-400" /> : <MapPin className="size-4 text-slate-400" />}
              {SESSION_MODE_LABEL[booking.mode]}
            </span>
            {place && booking.mode === 'ONLINE' && (
              <a href={place} target="_blank" rel="noreferrer" className="max-w-64 truncate text-brand-600 hover:underline">
                {place}
              </a>
            )}
            {place && booking.mode === 'AT_HOME' && <span className="text-slate-500">{place}</span>}
          </p>

          <p className="mt-2 text-sm">
            {phone ? (
              <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                <Phone className="size-4" /> {phone}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 italic text-slate-500">
                <Phone className="size-4" /> {phoneHiddenHint(role)}
              </span>
            )}
          </p>
        </div>

        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <p className="text-base font-semibold text-slate-900">{formatVnd(booking.price)}</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                variant={action === 'CONFIRM' ? 'primary' : 'secondary'}
                className="px-3 py-1.5"
                loading={pending}
                disabled={pending}
                onClick={() => onAction(action, booking)}
              >
                {ACTION_LABEL[action]}
              </Button>
            ))}
            {mayReview && (
              <Button className="px-3 py-1.5" onClick={() => onReview(booking)}>
                <Star className="size-4" /> Đánh giá
              </Button>
            )}
            {mayCancel && (
              <Button variant="danger" className="px-3 py-1.5" disabled={pending} onClick={() => onCancel(booking)}>
                Hủy
              </Button>
            )}
            <Button variant="ghost" className="px-3 py-1.5" onClick={() => onOpen(booking)}>
              Chi tiết <ChevronRight className="size-4" />
            </Button>
          </div>
          {mayCancel && hoursUntilStart(booking.startAt) < CANCEL_MIN_HOURS && (
            <p className="text-xs text-amber-600">
              Buổi học bắt đầu trong vòng {CANCEL_MIN_HOURS} giờ — yêu cầu hủy có thể bị từ chối.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
