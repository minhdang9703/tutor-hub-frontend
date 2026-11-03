import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { addDays, formatDistanceToNow } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale/vi'
import { ApiClientError } from '../../api/client'
import { fetchDistricts, fetchSubjects } from '../../api/catalog'
import { fetchChildren } from '../../api/parent'
import {
  acceptApplication,
  applyToRequest,
  closeRequest,
  createRequest,
  fetchMyApplications,
  fetchRequest,
  rejectApplication,
  updateRequest,
  withdrawApplication,
} from '../../api/request'
import { fetchMyTutorProfile } from '../../api/tutor'
import type { ApplicationInput, SessionMode, Subject, District, Child, TutorRequest, TutorRequestInput, TutorProfileMine } from '../../api/types'
import { SESSION_MODE_LABEL } from '../../lib/labels'
import { formatDateTime, formatVnd, fromLocalInputValue, toLocalInputValue } from '../../lib/format'

/**
 * /requests và /requests/mine chỉ nhận page/size (RequestService.open/mine), mọi bộ lọc trong UI
 * đều chạy trên dữ liệu của trang đang xem và phải được dán nhãn như vậy.
 */
export const REQUEST_PAGE_SIZE = 10

/** Kích thước trang dùng khi quét /applications/mine để tìm đơn của chính mình ở trang chi tiết. */
export const OWN_APPLICATION_SCAN_SIZE = 100

/** Ràng buộc khớp @Valid trong TutorRequestInput và ApplicationInput của backend. */
export const GRADES: number[] = Array.from({ length: 12 }, (_, index) => index + 1)
export const MODE_VALUES: SessionMode[] = ['ONLINE', 'AT_HOME']
export const SESSIONS_MIN = 1
export const SESSIONS_MAX = 14
export const SCHEDULE_NOTE_MAX = 500
export const DESCRIPTION_MAX = 10_000
export const MESSAGE_MAX = 1_000
export const RATE_STEP = 50_000
export const EXPIRY_PRESET_DAYS: number[] = [7, 14, 30]

/** Link trông như Button variant="secondary" (Button render <button> nên không bọc được Link). */
export const linkButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50'

// ---------------------------------------------------------------- query keys

export const openRequestsKey = (page: number) => ['requests', 'open', page] as const
export const myRequestsKey = (page: number) => ['requests', 'mine', page] as const
export const requestKey = (id: number) => ['request', id] as const
export const requestApplicationsKey = (id: number) => ['request', id, 'applications'] as const
export const myApplicationsKey = (page: number, size: number) => ['applications', 'mine', page, size] as const

/** Object useQuery cho chi tiết một yêu cầu; trang gọi thêm enabled theo vai người xem. */
export function requestQueryOptions(id: number) {
  return { queryKey: requestKey(id), queryFn: () => fetchRequest(id) }
}

/** Object useQuery cho /applications/mine; dùng cả cho danh sách và cho quét đơn của mình. */
export function ownApplicationQueryOptions(page: number, size: number) {
  return { queryKey: myApplicationsKey(page, size), queryFn: () => fetchMyApplications(page, size) }
}

/**
 * Nhận đơn là transaction có row lock: accept đầu tiên thắng, các đơn cùng yêu cầu bị REJECTED và
 * yêu cầu chuyển MATCHED. Vì vậy phải làm mới cả hai phía: danh sách, chi tiết và đơn của tôi.
 */
export function invalidateRequestViews(queryClient: QueryClient, requestId?: number) {
  queryClient.invalidateQueries({ queryKey: ['requests'] })
  queryClient.invalidateQueries({ queryKey: ['applications', 'mine'] })
  if (requestId != null) {
    queryClient.invalidateQueries({ queryKey: requestKey(requestId) })
    queryClient.invalidateQueries({ queryKey: requestApplicationsKey(requestId) })
  }
}

// ---------------------------------------------------------------- danh mục (cache chung)

export interface RequestCatalog {
  subjects: Subject[]
  districts: District[]
  cities: string[]
  subjectNames: Map<number, string>
  districtNames: Map<number, string>
  isLoading: boolean
}

/** Môn học và quận huyện dùng đúng key ['catalog', …] mà các trang danh mục đã dùng. */
export function useRequestCatalog(): RequestCatalog {
  const subjectsQuery = useQuery({ queryKey: ['catalog', 'subjects'], queryFn: fetchSubjects })
  const districtsQuery = useQuery({ queryKey: ['catalog', 'districts'], queryFn: () => fetchDistricts() })

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data])
  const districts = useMemo(() => districtsQuery.data ?? [], [districtsQuery.data])
  const subjectNames = useMemo(() => new Map(subjects.map((s) => [s.id, s.name] as const)), [subjects])
  const districtNames = useMemo(() => new Map(districts.map((d) => [d.id, `${d.name}, ${d.city}`] as const)), [districts])
  const cities = useMemo(() => [...new Set(districts.map((d) => d.city))], [districts])

  return {
    subjects,
    districts,
    cities,
    subjectNames,
    districtNames,
    isLoading: subjectsQuery.isLoading || districtsQuery.isLoading,
  }
}

export interface ChildDirectory {
  children: Child[]
  childNames: Map<number, string>
  isLoading: boolean
}

/** GET /parents/me/children trả 403 với gia sư, nên trang bên gia sư phải tắt query này. */
export function useChildDirectory(enabled: boolean): ChildDirectory {
  const childrenQuery = useQuery({ queryKey: ['parent', 'children'], queryFn: fetchChildren, enabled })
  const children = useMemo(() => (enabled ? (childrenQuery.data ?? []) : []), [childrenQuery.data, enabled])
  const childNames = useMemo(() => new Map(children.map((c) => [c.id, c.name] as const)), [children])
  return { children, childNames, isLoading: enabled && childrenQuery.isLoading }
}

/**
 * Hồ sơ gia sư của chính mình: hourlyRate để prefill proposedRate, verificationStatus để chặn
 * hành động (backend chỉ cho VERIFIED đọc /requests, ứng tuyển và xem đơn).
 */
export function useMyTutorProfile(enabled: boolean) {
  const query = useQuery({
    queryKey: ['tutor', 'me'],
    queryFn: fetchMyTutorProfile,
    enabled,
    retry: false,
  })
  const profile: TutorProfileMine | null = query.data ?? null
  return {
    profile,
    /** Chỉ VERIFIED mới gọi được các endpoint dành cho gia sư. */
    canAct: profile != null && profile.verificationStatus === 'VERIFIED',
    isLoading: enabled && query.isLoading,
    refetch: query.refetch,
  }
}

// ---------------------------------------------------------------- ngày & tiền

/** Date -> chuỗi cho input datetime-local, theo giờ máy người dùng. */
export function localDateTimeValue(date: Date): string {
  return toLocalInputValue(date.toISOString())
}

export function expiryPresetValue(days: number): string {
  return localDateTimeValue(addDays(new Date(), days))
}

export function isPastIso(iso: string): boolean {
  const time = new Date(iso).getTime()
  return Number.isNaN(time) || time <= Date.now()
}

/** formatDistanceToNow với locale vi; nếu lỗi thì lùi về ngày tuyệt đối. */
export function relativeToNow(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return formatDateTime(iso)
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: viLocale })
  } catch {
    return formatDateTime(iso)
  }
}

export type ExpiryState = 'none' | 'active' | 'soon' | 'past'

const SOON_MS = 24 * 60 * 60 * 1000

/** Job expire() của backend chạy mỗi 60 giây nên UI vẫn phải tự nhận diện yêu cầu quá hạn. */
export function expiryState(request: TutorRequest): ExpiryState {
  if (!request.expiresAt) return 'none'
  const time = new Date(request.expiresAt).getTime()
  if (Number.isNaN(time) || time <= Date.now()) return 'past'
  if (time - Date.now() <= SOON_MS) return 'soon'
  return 'active'
}

/** Dòng đếm ngược ngắn gọn; chỉ nên hiển thị khi yêu cầu còn OPEN. */
export function expiryLabel(request: TutorRequest): string {
  if (!request.expiresAt) return 'Không có ngày hết hạn'
  const relative = relativeToNow(request.expiresAt)
  return isPastIso(request.expiresAt) ? `Hết hạn ${relative}` : `Hạn chót ${relative}`
}

export function budgetLabel(budgetMin: number | null, budgetMax: number | null): string {
  if (budgetMin != null && budgetMax != null) {
    return budgetMin === budgetMax
      ? `${formatVnd(budgetMin)}/buổi`
      : `${formatVnd(budgetMin)} – ${formatVnd(budgetMax)}/buổi`
  }
  if (budgetMin != null) return `Từ ${formatVnd(budgetMin)}/buổi`
  if (budgetMax != null) return `Tối đa ${formatVnd(budgetMax)}/buổi`
  return 'Chưa đặt ngân sách'
}

export interface Fact {
  label: string
  value: string
}

export interface NameMaps {
  subjectNames: Map<number, string>
  districtNames: Map<number, string>
  /** Truyền map rỗng khi người xem không có quyền đọc tên con (phía gia sư). */
  childNames: Map<number, string>
}

/** Gom ba map tên vào một object có tham chiếu ổn định để truyền vào requestFacts. */
export function useMemoNameMaps(
  subjectNames: Map<number, string>,
  districtNames: Map<number, string>,
  childNames: Map<number, string>,
): NameMaps {
  return useMemo(() => ({ subjectNames, districtNames, childNames }), [subjectNames, districtNames, childNames])
}

/** Bảng thông tin yêu cầu dùng chung mọi trang; giá trị luôn là chuỗi để trang chỉ việc render. */
export function requestFacts(request: TutorRequest, names: NameMaps): Fact[] {
  const subject = names.subjectNames.get(request.subjectId) ?? `Môn #${request.subjectId}`
  const district = request.districtId != null ? names.districtNames.get(request.districtId) : undefined
  const child = request.childId != null ? names.childNames.get(request.childId) : undefined

  const facts: Fact[] = [
    { label: 'Môn học', value: subject },
    { label: 'Khối lớp', value: `Lớp ${request.grade}` },
    { label: 'Hình thức', value: SESSION_MODE_LABEL[request.mode] },
    { label: 'Khu vực', value: district ?? (request.mode === 'ONLINE' ? 'Toàn quốc (online)' : 'Chưa xác định') },
    { label: 'Ngân sách', value: budgetLabel(request.budgetMin, request.budgetMax) },
    {
      label: 'Tần suất',
      value: request.sessionsPerWeek != null ? `${request.sessionsPerWeek} buổi/tuần` : 'Chưa xác định',
    },
  ]
  if (child != null) facts.push({ label: 'Con', value: child })
  return facts
}

// ---------------------------------------------------------------- nháp biểu mẫu & kiểm tra

/** Trường số giữ dạng chuỗi để phân biệt "bỏ trống" với 0. */
export interface RequestDraft {
  childId: string
  subjectId: string
  grade: string
  districtId: string
  mode: SessionMode
  budgetMin: string
  budgetMax: string
  sessionsPerWeek: string
  scheduleNote: string
  description: string
  expiresAt: string
}

export type RequestField = keyof RequestDraft
export type RequestErrors = Partial<Record<RequestField, string>>

export function emptyRequestDraft(): RequestDraft {
  return {
    childId: '',
    subjectId: '',
    grade: '',
    districtId: '',
    mode: 'ONLINE',
    budgetMin: '',
    budgetMax: '',
    sessionsPerWeek: '',
    scheduleNote: '',
    description: '',
    expiresAt: '',
  }
}

/** Edit là PATCH thay thế toàn bộ bản ghi, nên nháp phải mang đủ mọi trường của yêu cầu. */
export function requestDraftFromRequest(request: TutorRequest): RequestDraft {
  return {
    childId: request.childId != null ? String(request.childId) : '',
    subjectId: String(request.subjectId),
    grade: String(request.grade),
    districtId: request.districtId != null ? String(request.districtId) : '',
    mode: request.mode,
    budgetMin: request.budgetMin != null ? String(request.budgetMin) : '',
    budgetMax: request.budgetMax != null ? String(request.budgetMax) : '',
    sessionsPerWeek: request.sessionsPerWeek != null ? String(request.sessionsPerWeek) : '',
    scheduleNote: request.scheduleNote ?? '',
    description: request.description ?? '',
    expiresAt: request.expiresAt ? toLocalInputValue(request.expiresAt) : '',
  }
}

interface NumberRead {
  value: number | null
  invalid: boolean
}

/** Backend nhận số nguyên (Long/Short, @PositiveOrZero) nên chỉ chấp nhận chuỗi chữ số. */
function readWholeNumber(raw: string): NumberRead {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: null, invalid: false }
  if (!/^\d+$/.test(trimmed)) return { value: null, invalid: true }
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? { value, invalid: false } : { value: null, invalid: true }
}

/** Trường số của nháp -> number | null; hữu ích cho xem trước và tự vẫn dùng khi gửi. */
export function wholeNumberOrNull(raw: string): number | null {
  return readWholeNumber(raw).value
}

export function validateRequestDraft(draft: RequestDraft): RequestErrors {
  const errors: RequestErrors = {}

  const subject = readWholeNumber(draft.subjectId)
  if (subject.invalid) errors.subjectId = 'Môn học không hợp lệ.'
  else if (subject.value == null) errors.subjectId = 'Chọn môn học cần tìm gia sư.'

  const grade = readWholeNumber(draft.grade)
  if (grade.invalid || (grade.value != null && (grade.value < 1 || grade.value > 12))) {
    errors.grade = 'Lớp phải là số nguyên từ 1 đến 12.'
  } else if (grade.value == null) {
    errors.grade = 'Chọn khối lớp.'
  }

  if (!MODE_VALUES.includes(draft.mode)) errors.mode = 'Chọn hình thức dạy: Online hoặc Tại nhà.'

  const district = readWholeNumber(draft.districtId)
  if (district.invalid) errors.districtId = 'Quận/huyện không hợp lệ.'

  const child = readWholeNumber(draft.childId)
  if (child.invalid) errors.childId = 'Con không hợp lệ.'

  const budgetMin = readWholeNumber(draft.budgetMin)
  const budgetMax = readWholeNumber(draft.budgetMax)
  if (budgetMin.invalid) errors.budgetMin = 'Ngân sách tối thiểu phải là số nguyên không âm (VND).'
  if (budgetMax.invalid) errors.budgetMax = 'Ngân sách tối đa phải là số nguyên không âm (VND).'
  // @AssertTrue validBudget(): server chỉ trả 400 VALIDATION_ERROR trần nên chặn ngay ở đây.
  if (budgetMin.value != null && budgetMax.value != null && budgetMax.value < budgetMin.value) {
    errors.budgetMax = 'Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu.'
  }

  const sessions = readWholeNumber(draft.sessionsPerWeek)
  if (sessions.invalid) {
    errors.sessionsPerWeek = `Số buổi mỗi tuần phải là số nguyên từ ${SESSIONS_MIN} đến ${SESSIONS_MAX}.`
  } else if (sessions.value != null && (sessions.value < SESSIONS_MIN || sessions.value > SESSIONS_MAX)) {
    errors.sessionsPerWeek = `Số buổi mỗi tuần phải từ ${SESSIONS_MIN} đến ${SESSIONS_MAX}.`
  }

  if (draft.scheduleNote.length > SCHEDULE_NOTE_MAX) {
    errors.scheduleNote = `Ghi chú lịch học tối đa ${SCHEDULE_NOTE_MAX} ký tự.`
  }
  if (draft.description.length > DESCRIPTION_MAX) {
    errors.description = `Mô tả tối đa ${DESCRIPTION_MAX} ký tự.`
  }

  const expiryRaw = draft.expiresAt.trim()
  if (expiryRaw !== '') {
    const expiryTime = new Date(expiryRaw).getTime()
    if (Number.isNaN(expiryTime)) errors.expiresAt = 'Ngày hết hạn không hợp lệ.'
    else if (expiryTime <= Date.now()) errors.expiresAt = 'Ngày hết hạn phải ở tương lai.'
  }

  return errors
}

export function countErrors(errors: RequestErrors): number {
  return Object.keys(errors).length
}

/** Chỉ gọi khi nháp hợp lệ: trường bỏ trống được loại hẳn khỏi payload để server ghi NULL. */
export function requestDraftToInput(draft: RequestDraft): TutorRequestInput {
  const input: TutorRequestInput = {
    subjectId: wholeNumberOrNull(draft.subjectId) ?? 0,
    grade: wholeNumberOrNull(draft.grade) ?? 1,
    mode: draft.mode,
    districtId: wholeNumberOrNull(draft.districtId),
  }

  const childId = wholeNumberOrNull(draft.childId)
  if (childId != null) input.childId = childId
  const budgetMin = wholeNumberOrNull(draft.budgetMin)
  if (budgetMin != null) input.budgetMin = budgetMin
  const budgetMax = wholeNumberOrNull(draft.budgetMax)
  if (budgetMax != null) input.budgetMax = budgetMax
  const sessionsPerWeek = wholeNumberOrNull(draft.sessionsPerWeek)
  if (sessionsPerWeek != null) input.sessionsPerWeek = sessionsPerWeek

  const scheduleNote = draft.scheduleNote.trim()
  if (scheduleNote !== '') input.scheduleNote = scheduleNote
  const description = draft.description.trim()
  if (description !== '') input.description = description

  const expiresAt = draft.expiresAt.trim()
  if (expiresAt !== '') input.expiresAt = fromLocalInputValue(expiresAt)

  return input
}

export interface RateValidation {
  error?: string
  value?: number
}

/** proposedRate là @NotNull @PositiveOrZero; message là @Size(max=1000). */
export function validateRate(raw: string): RateValidation {
  const parsed = readWholeNumber(raw)
  if (parsed.invalid) return { error: 'Học phí đề xuất phải là số nguyên không âm (VND).' }
  if (parsed.value == null) return { error: 'Nhập mức học phí đề xuất cho mỗi buổi.' }
  return { value: parsed.value }
}

// ---------------------------------------------------------------- mutations

export interface SaveRequestVariables {
  requestId?: number
  input: TutorRequestInput
}

/** CREATE và EDIT (PATCH thay thế) dùng chung một mutation để RequestForm không lặp logic. */
export function useSaveRequest(onSaved: (request: TutorRequest) => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: SaveRequestVariables) =>
      variables.requestId != null ? updateRequest(variables.requestId, variables.input) : createRequest(variables.input),
    onSuccess: (saved, variables) => {
      invalidateRequestViews(queryClient, saved.id)
      toast.success(variables.requestId != null ? 'Đã cập nhật yêu cầu.' : 'Đã đăng yêu cầu tìm gia sư.')
      onSaved(saved)
    },
  })
}

export function useCloseRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: number) => closeRequest(requestId),
    onSuccess: (_result, requestId) => {
      invalidateRequestViews(queryClient, requestId)
      toast.success('Đã đóng yêu cầu.')
    },
  })
}

export function useApplyToRequest(requestId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplicationInput) => applyToRequest(requestId, input),
    onSuccess: (application) => {
      // invalidateRequestViews phủ ['request', id] và ['request', id, 'applications']
      invalidateRequestViews(queryClient, application.requestId)
      toast.success('Đã gửi đơn ứng tuyển.')
    },
  })
}

export type ApplicationAction = 'ACCEPT' | 'REJECT' | 'WITHDRAW'

export const APPLICATION_ACTION_LABEL: Record<ApplicationAction, string> = {
  ACCEPT: 'Chọn gia sư này',
  REJECT: 'Từ chối',
  WITHDRAW: 'Rút đơn',
}

export interface ApplicationActionVariables {
  action: ApplicationAction
  applicationId: number
  requestId: number
}

const ACTION_API: Record<ApplicationAction, (id: number) => Promise<void>> = {
  ACCEPT: acceptApplication,
  REJECT: rejectApplication,
  WITHDRAW: withdrawApplication,
}

const ACTION_DONE: Record<ApplicationAction, string> = {
  ACCEPT: 'Đã chọn gia sư. Các đơn còn lại trong yêu cầu này bị từ chối.',
  REJECT: 'Đã từ chối đơn ứng tuyển.',
  WITHDRAW: 'Đã rút đơn ứng tuyển.',
}

export function useApplicationActionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ action, applicationId }: ApplicationActionVariables) => ACTION_API[action](applicationId),
    onSuccess: (_result, { action, requestId }) => {
      invalidateRequestViews(queryClient, requestId)
      toast.success(ACTION_DONE[action])
    },
  })
}

/**
 * apply/accept/reject/withdraw đều có thể bị chặn phía server. Backend trả message tiếng Anh,
 * nên dịch sẵn sang tiếng Việt và để self-check on lỗi thô của backend.
 */
export function describeRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return 'Dữ liệu chưa hợp lệ. Kiểm tra lại các trường được đánh dấu đỏ.'
      case 'UNAUTHORIZED':
        return 'Bạn không có quyền thao tác với yêu cầu này.'
      case 'NOT_FOUND':
        return 'Không tìm thấy yêu cầu, hoặc yêu cầu không còn mở.'
      case 'CONFLICT':
        return 'Đơn đã được xử lý hoặc bạn đã ứng tuyển yêu cầu này.'
      case 'BUSINESS_RULE':
        return 'Yêu cầu không còn ở trạng thái mở.'
      // Message của backend là tiếng Anh nên Việt hoá các mã lỗi riêng của module request.
      case 'APPLICATION_EXISTS':
        return 'Mỗi gia sư chỉ có một đơn cho một yêu cầu — bạn đã ứng tuyển trước đó.'
      case 'APPLICATION_NOT_PENDING':
        return 'Đơn này không còn ở trạng thái chờ (một tab khác đã xử lý).'
      case 'REQUEST_NOT_OPEN':
        return 'Yêu cầu đã đóng, hết hạn hoặc đã ghép gia sư nên không nhận đơn mới.'
      default:
        return error.message
    }
  }
  if (error instanceof Error) return error.message
  return 'Có lỗi xảy ra.'
}
