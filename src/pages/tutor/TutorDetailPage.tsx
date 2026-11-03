import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { CalendarPlus, GraduationCap, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import { fetchFreeSlots, fetchTutor, fetchTutorReviews } from '../../api/tutor'
import { fetchDistricts } from '../../api/catalog'
import type { AvailabilitySlot } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { EDUCATION_LABEL, MODE_LABEL } from '../../lib/labels'
import { formatDate, formatVnd } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Input, PageNav, Spinner, Stars } from '../../components/ui'

const REVIEWS_PER_PAGE = 5

/** Backend chỉ trả khung giờ của MỘT ngày, nên trang dùng bộ chọn ngày (mặc định hôm nay). */
function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "HH:mm:ss" -> "HH:mm" để hiển thị và nối vào URL đặt lịch. */
function hhmm(value: string): string {
  return value.slice(0, 5)
}

function dayLabel(date: string): string {
  if (date === todayIso()) return 'Hôm nay'
  if (date === addDaysIso(1)) return 'Ngày mai'
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(
    new Date(`${date}T00:00:00`),
  )
}

function bookingHref(tutorId: number, date: string, slot?: AvailabilitySlot): string {
  const params = new URLSearchParams({ tutorId: String(tutorId), date })
  if (slot) {
    params.set('start', hhmm(slot.startTime))
    params.set('end', hhmm(slot.endTime))
  }
  return `/bookings?${params.toString()}`
}

export default function TutorDetailPage() {
  const { id } = useParams()
  const tutorId = Number(id)
  const { user } = useAuth()
  const [date, setDate] = useState(todayIso)
  const [reviewPage, setReviewPage] = useState(0)

  const tutorQuery = useQuery({
    queryKey: ['tutor', tutorId],
    queryFn: () => fetchTutor(tutorId),
    enabled: Number.isFinite(tutorId),
  })
  const districtsQuery = useQuery({ queryKey: ['catalog', 'districts'], queryFn: () => fetchDistricts() })
  const slotsQuery = useQuery({
    queryKey: ['tutor', tutorId, 'free-slots', date],
    queryFn: () => fetchFreeSlots(tutorId, date),
    enabled: Number.isFinite(tutorId),
  })
  const reviewsQuery = useQuery({
    queryKey: ['tutor', tutorId, 'reviews', reviewPage],
    queryFn: () => fetchTutorReviews(tutorId, reviewPage, REVIEWS_PER_PAGE),
    enabled: Number.isFinite(tutorId),
  })

  const district = useMemo(() => {
    const tutor = tutorQuery.data
    if (!tutor || tutor.districtId == null) return undefined
    return (districtsQuery.data ?? []).find((d) => d.id === tutor.districtId)
  }, [districtsQuery.data, tutorQuery.data])

  const upcomingDays = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((offset) => addDaysIso(offset)), [])

  if (tutorQuery.isLoading) return <Spinner />

  if (tutorQuery.isError || !tutorQuery.data) {
    return (
      <EmptyState>
        Không tìm thấy hồ sơ gia sư này — chỉ hồ sơ đã được xác minh mới hiển thị công khai.
        <div className="mt-3">
          <Link to="/tutors" className="text-sm font-medium text-brand-600">← Quay lại danh sách</Link>
        </div>
      </EmptyState>
    )
  }

  const tutor = tutorQuery.data
  const rating = Number.isFinite(Number(tutor.ratingAvg)) ? Number(tutor.ratingAvg) : 0
  const slots = slotsQuery.data ?? []
  const canBook = user?.role === 'PARENT'
  const educationLabel = tutor.educationLevel ? EDUCATION_LABEL[tutor.educationLevel] : undefined

  return (
    <div className="space-y-6">
      <Link to="/tutors" className="text-sm text-slate-500 hover:text-brand-600">← Danh sách gia sư</Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-start gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xl font-bold text-brand-600">
                {initialsOf(tutor.fullName)}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{tutor.fullName}</h1>
                <p className="mt-0.5 text-sm text-slate-500">{tutor.headline ?? 'Gia sư trên TutorHub'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <Stars value={rating} /> {rating.toFixed(1)} ({tutor.ratingCount} đánh giá)
                  </span>
                  {district && (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <MapPin className="size-4" /> {district.name}, {district.city}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="green">Hồ sơ đã xác minh</Badge>
                  <Badge tone="blue">{MODE_LABEL[tutor.teachingMode]}</Badge>
                </div>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Info label="Học phí" value={`${formatVnd(tutor.hourlyRate)}/giờ`} />
              <Info label="Kinh nghiệm" value={`${tutor.yearsExperience} năm`} />
              <Info label="Trình độ" value={educationLabel ?? 'Chưa cập nhật'} />
              <Info label="Đánh giá" value={`${rating.toFixed(1)} / 5`} />
            </dl>

            {tutor.bio && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-slate-600">{tutor.bio}</p>}
            {tutor.school && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500">
                <GraduationCap className="size-4" /> {tutor.school}{tutor.major ? ` — ${tutor.major}` : ''}
              </p>
            )}
          </Card>

          <Card title="Môn dạy">
            {tutor.subjects.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {tutor.subjects.map((s) => (
                  <li key={s.subjectId}>
                    <Badge tone="blue">
                      {s.name} · Lớp {s.gradeFrom === s.gradeTo ? s.gradeFrom : `${s.gradeFrom}–${s.gradeTo}`}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Chưa có thông tin môn dạy.</p>
            )}
          </Card>

          <Card
            title="Khung giờ trống"
            actions={
              <Input
                aria-label="Chọn ngày"
                type="date"
                className="w-44"
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value || todayIso())}
              />
            }
          >
            <div className="mb-4 flex flex-wrap gap-1.5">
              {upcomingDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDate(day)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    day === date ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {dayLabel(day)}
                </button>
              ))}
            </div>

            {slotsQuery.isLoading ? (
              <Spinner />
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ngày {formatDate(`${date}T00:00:00`)} không còn khung giờ trống. Hãy thử ngày khác — lịch rảnh
                của gia sư lặp lại theo từng tuần.
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  {dayLabel(date)} — {slots.length} khung giờ trống
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {slots.map((s) => (
                    <li key={`${s.dayOfWeek}-${s.startTime}-${s.endTime}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-700">{hhmm(s.startTime)} – {hhmm(s.endTime)}</span>
                      {canBook ? (
                        <Link
                          to={bookingHref(tutor.id, date, s)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                        >
                          <CalendarPlus className="size-4" /> Đặt
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Trống</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Đặt buổi học">
            <div className="space-y-3 text-sm text-slate-600">
              <p className="text-lg font-semibold text-slate-900">
                {formatVnd(tutor.hourlyRate)} <span className="text-sm font-normal text-slate-500">/ giờ</span>
              </p>
              <p>Chọn một khung giờ trống rồi sang trang Lịch học để gửi yêu cầu. Gia sư sẽ xác nhận trước buổi học.</p>
              {canBook ? (
                <Link to={bookingHref(tutor.id, date)}>
                  <Button className="w-full">
                    <CalendarPlus className="size-4" /> Đặt lịch
                  </Button>
                </Link>
              ) : (
                <Link to={`/login?next=${encodeURIComponent(`/tutors/${tutor.id}`)}`}>
                  <Button className="w-full" disabled={user?.role === 'TUTOR'}>
                    <CalendarPlus className="size-4" /> {user ? 'Đăng nhập để đặt lịch' : 'Đăng nhập / Đăng ký'}
                  </Button>
                </Link>
              )}
              {!user && <p className="text-xs text-slate-500">Cần tài khoản phụ huynh đã xác minh email để đặt lịch.</p>}
              {user?.role === 'TUTOR' && <p className="text-xs text-slate-500">Gia sư không thể tự đặt buổi học.</p>}
              {user?.status === 'PENDING_VERIFICATION' && (
                <p className="text-xs text-amber-600">Email chưa được xác minh — hãy kiểm tra hộp thư để xác nhận.</p>
              )}
              <p className="text-xs text-slate-400">Chỉ nhận xét và khung giờ của hồ sơ đã xác minh mới hiển thị ở đây.</p>
            </div>
          </Card>

          <Card title={`Đánh giá (${tutor.ratingCount})`}>
            {reviewsQuery.isLoading ? (
              <Spinner />
            ) : reviewsQuery.data && reviewsQuery.data.content.length > 0 ? (
              <div className="space-y-4">
                {reviewsQuery.data.content.map((r) => (
                  <article key={r.id} className="rounded-lg bg-slate-50 p-3.5">
                    <header className="flex items-center justify-between gap-2">
                      <Stars value={r.rating} />
                      <time className="text-xs text-slate-400">{formatDate(r.createdAt)}</time>
                    </header>
                    {/* Backend không trả tên phụ huynh trong danh sách đánh giá. */}
                    <p className="mt-1 text-xs font-medium text-slate-500">Phụ huynh</p>
                    {r.comment && <p className="mt-2 text-sm text-slate-700">{r.comment}</p>}
                    {r.reply && (
                      <p className="mt-2 border-l-2 border-brand-200 pl-3 text-xs text-slate-500">
                        <span className="font-medium">Phản hồi của gia sư:</span> {r.reply}
                      </p>
                    )}
                  </article>
                ))}
                <PageNav page={reviewPage} totalPages={reviewsQuery.data.totalPages} onChange={setReviewPage} />
              </div>
            ) : (
              <EmptyState>Chưa có đánh giá nào cho gia sư này.</EmptyState>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  const first = parts[0] ?? ''
  return (parts.length > 1 ? first[0] + last[0] : last.slice(0, 2)).toUpperCase()
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
