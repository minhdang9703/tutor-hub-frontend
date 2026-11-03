import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search, ShieldCheck, Users, X, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { fetchDistricts, fetchSubjects } from '../../api/catalog'
import { searchTutors } from '../../api/tutor'
import type { District, SessionMode, Subject, TutorCard, TutorSearchFilters } from '../../api/types'
import { MODE_LABEL, SESSION_MODE_LABEL } from '../../lib/labels'
import { Badge, Button, Card, EmptyState, Input, PageNav, Select, Spinner, Stars } from '../../components/ui'
import { formatVnd } from '../../lib/format'

/** Backend chỉ nhận ba khóa sắp xếp thô (không có hướng), mặc định newest. */
const SORT_OPTIONS: { value: NonNullable<TutorSearchFilters['sort']>; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
  { value: 'rate', label: 'Theo học phí' },
]

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)
const RATING_STEPS = [4.5, 4, 3.5, 3]

/** Bộ lọc dạng văn bản do người dùng gõ — chỉ áp dụng khi bấm Tìm để không gọi API mỗi phím. */
type TextFilters = Pick<TutorSearchFilters, 'q' | 'minRate' | 'maxRate'>

const AVATAR_TONES = [
  'bg-brand-50 text-brand-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-sky-50 text-sky-700',
  'bg-rose-50 text-rose-700',
]

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  const first = parts[0] ?? ''
  return (parts.length > 1 ? first[0] + last[0] : last.slice(0, 2)).toUpperCase()
}

function avatarTone(id: number): string {
  return AVATAR_TONES[id % AVATAR_TONES.length]
}

/** ratingAvg là NUMERIC(3,2) nên có thể sang dạng "4.50" — luôn chuẩn hoá về number. */
function ratingOf(value: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default function TutorBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => fromParams(searchParams), [searchParams])
  const [draft, setDraft] = useState<TextFilters>(() => pickText(filters))

  useEffect(() => {
    setDraft(pickText(filters))
  }, [filters])

  const tutorsQuery = useQuery({
    queryKey: ['tutors', 'search', filters],
    queryFn: () => searchTutors(filters),
  })
  const subjectsQuery = useQuery({ queryKey: ['catalog', 'subjects'], queryFn: fetchSubjects })
  const districtsQuery = useQuery({ queryKey: ['catalog', 'districts'], queryFn: () => fetchDistricts() })

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data])
  const districts = useMemo(() => districtsQuery.data ?? [], [districtsQuery.data])
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const districtById = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts])
  const cities = useMemo(() => [...new Set(districts.map((d) => d.city))], [districts])

  /** Ghi bộ lọc lên URL; giữ kèm phần text đang gõ để không mất dữ liệu nháp. */
  function apply(patch: Partial<TutorSearchFilters>, page = 0) {
    setSearchParams(toParams({ ...filters, ...draft, ...patch, page }), { replace: true })
  }

  function submitTextFilters(e: { preventDefault: () => void }) {
    e.preventDefault()
    apply({
      q: draft.q?.trim() || undefined,
      minRate: draft.minRate,
      maxRate: draft.maxRate,
    })
  }

  function clearAll() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const page = tutorsQuery.data
  const chips = buildChips(filters, subjectById, districtById)
  const hasFilters = chips.length > 0 || filters.q != null

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white shadow-sm">
        <div className="grid items-center gap-8 px-6 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-10 lg:py-14">
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              Tìm gia sư phù hợp
              <br />
              cho{' '}<span className="relative inline-block text-amber-400">con bạn<svg
                  aria-hidden="true"
                  viewBox="0 0 120 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full text-amber-400"
                >
                  <path d="M2 9C30 3 62 2 118 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg></span>.
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-brand-100 sm:text-base">
              Kết nối nhanh chóng với đội ngũ gia sư chất lượng, phù hợp với môn học, trình độ và mục tiêu của con.
            </p>

            <form
              onSubmit={submitTextFilters}
              className="mt-7 flex max-w-xl items-center gap-2 rounded-full bg-white p-1.5 shadow-lg"
            >
              <Search className="ml-3 size-5 shrink-0 text-slate-400" />
              <input
                value={draft.q ?? ''}
                onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                placeholder="Nhập môn học, lớp học hoặc nhu cầu..."
                aria-label="Từ khóa"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-amber-300"
              >
                Tìm ngay
                <ChevronRight className="size-4" />
              </button>
            </form>

            <ul className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-medium">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-5 shrink-0" /> Gia sư được xác minh
              </li>
              <li className="flex items-center gap-2">
                <Zap className="size-5 shrink-0 text-amber-400" /> Kết nối nhanh
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-5 shrink-0" /> Đa dạng môn học
              </li>
            </ul>
          </div>

          <img
            src="/hero-illustration.png"
            alt="Gia sư đang kèm một học sinh tiểu học bên chiếc laptop"
            width={1536}
            height={1024}
            className="hidden max-h-80 w-full rounded-xl object-cover object-center lg:block"
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card title="Bộ lọc">
            <div className="space-y-4">
              <Select
                label="Môn học"
                value={filters.subjectId ?? ''}
                onChange={(e) => apply({ subjectId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Tất cả môn</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>

              <Select
                label="Khối lớp"
                value={filters.grade ?? ''}
                onChange={(e) => apply({ grade: e.target.value ? Number(e.target.value) : undefined })}
                hint="Chỉ hiện gia sư dạy dải lớp bao gồm lớp đã chọn."
              >
                <option value="">Tất cả khối</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>Lớp {g}</option>
                ))}
              </Select>

              <Select
                label="Hình thức dạy"
                value={filters.mode ?? ''}
                onChange={(e) => apply({ mode: (e.target.value || undefined) as SessionMode })}
                hint="Gia sư dạy cả hai hình thức luôn được đưa vào kết quả."
              >
                <option value="">Tất cả</option>
                {(Object.keys(SESSION_MODE_LABEL) as SessionMode[]).map((m) => (
                  <option key={m} value={m}>{SESSION_MODE_LABEL[m]}</option>
                ))}
              </Select>

              <Select
                label="Quận / Huyện"
                value={filters.districtId ?? ''}
                onChange={(e) => apply({ districtId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Toàn quốc</option>
                {cities.map((city) => (
                  <optgroup key={city} label={city}>
                    {districts
                      .filter((d) => d.city === city)
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </optgroup>
                ))}
              </Select>

              <Select
                label="Đánh giá tối thiểu"
                value={filters.minRating ?? ''}
                onChange={(e) => apply({ minRating: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Không yêu cầu</option>
                {RATING_STEPS.map((r) => (
                  <option key={r} value={r}>{r}+ sao</option>
                ))}
              </Select>

              <form onSubmit={submitTextFilters} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Học phí tối thiểu"
                    type="number"
                    min={0}
                    step={50_000}
                    placeholder="VNĐ"
                    value={draft.minRate ?? ''}
                    onChange={(e) => setDraft({ ...draft, minRate: e.target.value ? Number(e.target.value) : undefined })}
                  />
                  <Input
                    label="Học phí tối đa"
                    type="number"
                    min={0}
                    step={50_000}
                    placeholder="VNĐ"
                    value={draft.maxRate ?? ''}
                    onChange={(e) => setDraft({ ...draft, maxRate: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <Button type="submit" variant="secondary" className="w-full">Áp dụng học phí</Button>
              </form>

              <Button variant="ghost" className="w-full" onClick={clearAll} disabled={!hasFilters}>
                Xóa tất cả bộ lọc
              </Button>
            </div>
          </Card>
        </aside>

        <section className="min-w-0">
          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => apply({ [chip.key]: undefined } as Partial<TutorSearchFilters>)}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100"
                >
                  {chip.label}
                  <X className="size-3" />
                </button>
              ))}
              {filters.q && (
                <button
                  type="button"
                  onClick={() => apply({ q: undefined })}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200"
                >
                  “{filters.q}”
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {tutorsQuery.isError && (
            <EmptyState>
              Chưa kết nối được backend TutorHub (mặc định localhost:8080). Khởi động Spring Boot hoặc
              docker-compose rồi tải lại trang.
            </EmptyState>
          )}

          {tutorsQuery.isLoading && <Spinner />}

          {page && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  {page.totalElements} gia sư đã xác minh{filters.q ? ` với từ khóa “${filters.q}”` : ''}
                </p>
                <Select
                  aria-label="Sắp xếp"
                  className="w-52"
                  value={filters.sort ?? 'newest'}
                  onChange={(e) => apply({ sort: e.target.value as NonNullable<TutorSearchFilters['sort']> })}
                >
                  {SORT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </div>

              {page.content.length === 0 ? (
                <EmptyState>Không tìm thấy gia sư nào khớp bộ lọc. Thử bỏ bớt một điều kiện lọc.</EmptyState>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {page.content.map((t) => (
                    <TutorCardRow key={t.id} tutor={t} district={t.districtId != null ? districtById.get(t.districtId) : undefined} />
                  ))}
                </ul>
              )}

              <PageNav page={page.page} totalPages={page.totalPages} onChange={(p) => apply({}, p)} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function TutorCardRow({ tutor, district }: { tutor: TutorCard; district: District | undefined }) {
  const rating = ratingOf(tutor.ratingAvg)
  return (
    <li>
      <Link
        to={`/tutors/${tutor.id}`}
        className="block h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{tutor.fullName}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
              {tutor.headline ?? 'Gia sư trên TutorHub'}
            </p>
          </div>
          <div className={clsx('flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold', avatarTone(tutor.id))}>
            {initialsOf(tutor.fullName)}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Stars value={rating} />
          <span>{rating.toFixed(1)}</span>
          <span className="text-slate-300">·</span>
          <span>{tutor.ratingCount} đánh giá</span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
          <div>
            <dt className="inline text-slate-400">Học phí: </dt>
            <dd className="inline font-medium">{formatVnd(tutor.hourlyRate)}/giờ</dd>
          </div>
          <div>
            <dt className="inline text-slate-400">Hình thức: </dt>
            <dd className="inline">{MODE_LABEL[tutor.teachingMode]}</dd>
          </div>
          {district && (
            <div className="col-span-2">
              <dt className="inline text-slate-400">Khu vực: </dt>
              <dd className="inline">{district.name}, {district.city}</dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="green">Đã xác minh</Badge>
          {tutor.ratingCount === 0 && <Badge tone="slate">Chưa có đánh giá</Badge>}
        </div>
      </Link>
    </li>
  )
}

function buildChips(
  filters: TutorSearchFilters,
  subjectById: Map<number, Subject>,
  districtById: Map<number, District>,
): { key: keyof TutorSearchFilters; label: string }[] {
  const chips: { key: keyof TutorSearchFilters; label: string }[] = []
  if (filters.subjectId != null) {
    chips.push({ key: 'subjectId', label: `Môn: ${subjectById.get(filters.subjectId)?.name ?? `#${filters.subjectId}`}` })
  }
  if (filters.grade != null) chips.push({ key: 'grade', label: `Lớp ${filters.grade}` })
  if (filters.mode != null) chips.push({ key: 'mode', label: SESSION_MODE_LABEL[filters.mode] })
  if (filters.districtId != null) {
    const d = districtById.get(filters.districtId)
    chips.push({ key: 'districtId', label: d ? `${d.name}, ${d.city}` : `Quận #${filters.districtId}` })
  }
  if (filters.minRating != null) chips.push({ key: 'minRating', label: `Từ ${filters.minRating} sao` })
  if (filters.minRate != null) chips.push({ key: 'minRate', label: `Tối thiểu ${formatVnd(filters.minRate)}` })
  if (filters.maxRate != null) chips.push({ key: 'maxRate', label: `Tối đa ${formatVnd(filters.maxRate)}` })
  return chips
}

const SORT_KEYS: NonNullable<TutorSearchFilters['sort']>[] = ['rating', 'rate', 'newest']

function pickText(filters: TutorSearchFilters): TextFilters {
  return { q: filters.q, minRate: filters.minRate, maxRate: filters.maxRate }
}

function fromParams(params: URLSearchParams): TutorSearchFilters {
  const num = (key: string) => {
    const raw = params.get(key)
    if (raw === null || raw === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  const mode = params.get('mode')
  const sort = params.get('sort')
  return {
    q: params.get('q') ?? undefined,
    subjectId: num('subjectId'),
    grade: num('grade'),
    districtId: num('districtId'),
    mode: mode === 'ONLINE' || mode === 'AT_HOME' ? mode : undefined,
    minRate: num('minRate'),
    maxRate: num('maxRate'),
    minRating: num('minRating'),
    sort: sort && SORT_KEYS.includes(sort as NonNullable<TutorSearchFilters['sort']>) ? (sort as NonNullable<TutorSearchFilters['sort']>) : undefined,
    page: num('page') ?? 0,
  }
}

function toParams(f: TutorSearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  const entries: Record<string, string | number | undefined> = {
    q: f.q, subjectId: f.subjectId, grade: f.grade, districtId: f.districtId,
    mode: f.mode, minRate: f.minRate, maxRate: f.maxRate, minRating: f.minRating,
    sort: f.sort, page: f.page ? f.page : undefined,
  }
  for (const [k, v] of Object.entries(entries)) if (v !== undefined && v !== '') params.set(k, String(v))
  return params
}
