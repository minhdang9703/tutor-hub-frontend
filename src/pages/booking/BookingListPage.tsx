import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, Repeat } from 'lucide-react'
import { fetchMyBookings } from '../../api/booking'
import type { Booking, BookingStatus } from '../../api/types'
import { BOOKING_STATUS_LABEL } from '../../lib/labels'
import { useAuth } from '../../auth/AuthContext'
import { Button, EmptyState, Select, Spinner } from '../../components/ui'
import { useBookingActions, type BookingAction } from './bookingLogic'
import BookingRowCard from './BookingRowCard'
import BookingDetail from './BookingDetail'
import CancelBookingDialog from './CancelBookingDialog'
import ReviewDialog from './ReviewDialog'
import NewRecurringDialog from './NewRecurringDialog'
import NewBookingDialog from './NewBookingDialog'

const STATUS_OPTIONS: Array<'ALL' | BookingStatus> = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{1,2}:\d{2}$/

/** Liên kết "Đặt" ở trang hồ sơ gia sư: /bookings?tutorId=..&date=..&start=HH:mm&end=HH:mm */
function oneOffFromParams(params: URLSearchParams) {
  const tutorId = Number(params.get('tutorId'))
  const date = params.get('date') ?? ''
  if (!Number.isInteger(tutorId) || tutorId <= 0 || !DATE_RE.test(date)) return null
  const start = params.get('start')
  const end = params.get('end')
  return {
    tutorId,
    date,
    start: start && TIME_RE.test(start) ? start : undefined,
    end: end && TIME_RE.test(end) ? end : undefined,
  }
}

export default function BookingListPage() {
  const { user } = useAuth()
  const role = user?.role ?? 'PARENT'
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL')
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const oneOff = role === 'PARENT' ? oneOffFromParams(searchParams) : null

  function closeOneOff() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of ['tutorId', 'date', 'start', 'end']) next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  const bookingsQuery = useQuery({ queryKey: ['bookings'], queryFn: fetchMyBookings })
  const { run, pendingId } = useBookingActions()

  const list = bookingsQuery.data ?? []
  const filtered = statusFilter === 'ALL' ? list : list.filter((b) => b.status === statusFilter)
  const detail = detailBooking ? (list.find((b) => b.id === detailBooking.id) ?? detailBooking) : null

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch học</h1>
          <p className="mt-1 text-sm text-slate-500">
            {role === 'TUTOR'
              ? 'Xác nhận yêu cầu, đánh dấu buổi đã dạy và buổi vắng mặt.'
              : 'Theo dõi yêu cầu đã gửi, hủy khi cần và đánh giá sau mỗi buổi học.'}
          </p>
        </div>
        {role === 'PARENT' && (
          <Button onClick={() => setRecurringOpen(true)}>
            <Repeat className="size-4" /> Tạo lịch học lặp lại
          </Button>
        )}
      </header>

      {bookingsQuery.isLoading && <Spinner />}

      {bookingsQuery.isError && (
        <EmptyState>
          <p>
            Không tải được lịch học. Hãy chắc chắn backend TutorHub đang chạy tại{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code> rồi thử lại.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => bookingsQuery.refetch()}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
            <Link to="/tutors" className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Tìm gia sư
            </Link>
          </div>
        </EmptyState>
      )}

      {!bookingsQuery.isLoading && !bookingsQuery.isError && list.length === 0 && (
        <EmptyState>
          <p className="mb-1 font-medium text-slate-600">Bạn chưa có buổi học nào.</p>
          {role === 'PARENT' ? (
            <p>
              Tìm gia sư phù hợp rồi gửi yêu cầu đặt lịch —{' '}
              <Link to="/tutors" className="font-medium text-brand-600 hover:underline">
                tìm gia sư ngay
              </Link>
              .
            </p>
          ) : (
            <p>Yêu cầu của phụ huynh và các buổi đã đặt sẽ xuất hiện tại đây.</p>
          )}
        </EmptyState>
      )}

      {list.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">{list.length} buổi học</p>
            <div className="w-52">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | BookingStatus)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'Tất cả trạng thái' : BOOKING_STATUS_LABEL[option]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState>Không có buổi học nào ở trạng thái này.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {filtered.map((booking) => (
                <li key={booking.id}>
                  <BookingRowCard
                    booking={booking}
                    role={role}
                    pending={pendingId === booking.id}
                    onAction={(action: BookingAction, b) => run(action, b.id)}
                    onCancel={setCancelTarget}
                    onReview={setReviewTarget}
                    onOpen={setDetailBooking}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {detail && <BookingDetail booking={detail} onClose={() => setDetailBooking(null)} />}

      {cancelTarget && <CancelBookingDialog key={cancelTarget.id} booking={cancelTarget} onClose={() => setCancelTarget(null)} />}

      {reviewTarget && <ReviewDialog key={reviewTarget.id} booking={reviewTarget} onClose={() => setReviewTarget(null)} />}

      {recurringOpen && <NewRecurringDialog onClose={() => setRecurringOpen(false)} />}

      {oneOff && (
        <NewBookingDialog
          key={`${oneOff.tutorId}-${oneOff.date}-${oneOff.start ?? ''}`}
          tutorId={oneOff.tutorId}
          date={oneOff.date}
          start={oneOff.start}
          end={oneOff.end}
          onClose={closeOneOff}
        />
      )}
    </div>
  )
}
