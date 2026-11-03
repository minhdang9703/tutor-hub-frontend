export type Role = 'PARENT' | 'TUTOR' | 'ADMIN'

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DELETED'

export interface User {
  id: number
  email: string
  phone: string | null
  fullName: string
  /** MinIO object key — backend never presigns avatars, so this is not a displayable URL. */
  avatarKey: string | null
  role: Role
  status: UserStatus
  emailVerifiedAt: string | null
}

export interface AuthTokenResponse {
  accessToken: string
  refreshToken: string
  /** seconds */
  expiresIn: number
}

export interface RegisterResult {
  userId: number
  message: string
}

export interface RegisterRequest {
  email: string
  password: string
  fullName: string
  phone?: string
  role: Extract<Role, 'PARENT' | 'TUTOR'>
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp?: string
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface Subject {
  id: number
  name: string
  slug: string
}

export interface District {
  id: number
  city: string
  name: string
}

export type EducationLevel = 'STUDENT' | 'BACHELOR' | 'MASTER' | 'PHD' | 'TEACHER'

export type TeachingMode = 'ONLINE' | 'AT_HOME' | 'BOTH'

export type SessionMode = 'ONLINE' | 'AT_HOME'

export type VerificationStatus = 'DRAFT' | 'PENDING' | 'VERIFIED' | 'REJECTED'

export type DocumentType = 'ID_CARD' | 'DEGREE' | 'STUDENT_CARD' | 'CERTIFICATE'

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface TutorSubject {
  subjectId: number
  name: string
  gradeFrom: number
  gradeTo: number
}

export interface TutorSubjectInput {
  subjectId: number
  gradeFrom: number
  gradeTo: number
}

export interface AvailabilitySlot {
  id?: number
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface TutorDocument {
  id: number
  type: DocumentType
  status: DocumentStatus
  url: string | null
  createdAt: string
}

export interface TutorReview {
  id: number
  rating: number
  comment: string | null
  reply: string | null
  createdAt: string
}

export interface TutorCard {
  id: number
  fullName: string
  headline: string | null
  hourlyRate: number
  teachingMode: TeachingMode
  districtId: number | null
  ratingAvg: number
  ratingCount: number
  createdAt: string
}

export interface TutorPublic {
  id: number
  fullName: string
  headline: string | null
  bio: string | null
  educationLevel: string | null
  school: string | null
  major: string | null
  yearsExperience: number
  hourlyRate: number
  teachingMode: TeachingMode
  districtId: number | null
  ratingAvg: number
  ratingCount: number
  subjects: TutorSubject[]
}

export interface TutorProfileMine {
  userId: number
  fullName: string
  headline: string | null
  bio: string | null
  educationLevel: string | null
  school: string | null
  major: string | null
  yearsExperience: number
  hourlyRate: number
  teachingMode: TeachingMode
  districtId: number | null
  verificationStatus: VerificationStatus
}

export interface TutorProfileInput {
  headline?: string
  bio?: string
  educationLevel?: string
  school?: string
  major?: string
  yearsExperience: number
  hourlyRate: number
  teachingMode: TeachingMode
  districtId?: number | null
}

export interface TutorSearchFilters {
  subjectId?: number
  grade?: number
  districtId?: number
  mode?: SessionMode
  minRate?: number
  maxRate?: number
  minRating?: number
  q?: string
  sort?: 'rating' | 'rate' | 'newest'
  page?: number
  size?: number
}

export interface Child {
  id: number
  name: string
  grade: number
  school: string | null
  notes: string | null
}

export interface ChildInput {
  name: string
  grade: number
  school?: string
  notes?: string
}

export interface ParentProfile {
  userId: number
  address: string | null
  districtId: number | null
}

export interface ParentProfileInput {
  address?: string
  districtId?: number | null
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export interface Booking {
  id: number
  tutorId: number
  parentId: number
  childId: number | null
  subjectId: number
  startAt: string
  endAt: string
  mode: SessionMode
  location: string | null
  meetingUrl: string | null
  price: number
  isTrial: boolean
  status: BookingStatus
  cancelReason: string | null
  tutorPhone: string | null
  parentPhone: string | null
}

export interface BookingInput {
  tutorId: number
  childId?: number
  subjectId: number
  startAt: string
  endAt: string
  mode: SessionMode
  location?: string
  meetingUrl?: string
  price: number
  isTrial?: boolean
}

export interface RecurringBookingInput {
  booking: BookingInput
  occurrences: number
}

export interface RecurringFailure {
  startAt: string
  code: string
  message: string
}

export interface RecurringResult {
  created: Booking[]
  failed: RecurringFailure[]
}

export type RequestStatus = 'OPEN' | 'MATCHED' | 'CLOSED' | 'EXPIRED'

export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

export interface TutorRequest {
  id: number
  parentId: number
  childId: number | null
  subjectId: number
  grade: number
  districtId: number | null
  mode: SessionMode
  budgetMin: number | null
  budgetMax: number | null
  sessionsPerWeek: number | null
  scheduleNote: string | null
  description: string | null
  status: RequestStatus
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TutorRequestInput {
  childId?: number
  subjectId: number
  grade: number
  districtId?: number | null
  mode: SessionMode
  budgetMin?: number
  budgetMax?: number
  sessionsPerWeek?: number
  scheduleNote?: string
  description?: string
  expiresAt?: string
}

export interface Application {
  id: number
  requestId: number
  tutorId: number
  message: string | null
  proposedRate: number
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
}

export interface ApplicationInput {
  message?: string
  proposedRate: number
}

export interface Conversation {
  id: number
  parentId: number
  tutorId: number
  requestId: number | null
  lastMessageAt: string | null
  createdAt: string
}

export interface Message {
  id: number
  senderId: number
  content: string
  readAt: string | null
  createdAt: string
  caution: boolean
}

export interface MessagePage {
  content: Message[]
  nextBeforeId: number | null
}

/** Notification rows come from raw JDBC column labels, so these keys are snake_case. */
export interface NotificationItem {
  id: number
  type: string
  title: string
  body: string | null
  data: unknown
  read_at: string | null
  created_at: string
}

export interface AdminUser {
  id: number
  email: string
  phone: string | null
  fullName: string
  role: Role
  status: UserStatus
  createdAt: string
}

export interface AdminReport {
  id: number
  reporterId: number
  targetType: string
  targetId: number
  reason: string
  description: string | null
  status: string
  resolvedBy: number | null
  resolution: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface AuditLog {
  id: number
  actorId: number | null
  action: string
  entityType: string
  entityId: number | null
  ipAddress: string | null
  createdAt: string
}

export interface AdminStats {
  users: number
  activeTutors: number
  openRequests: number
  pendingBookings: number
  completedBookings: number
  openReports: number
}

export interface DocumentReviewInput {
  status: 'APPROVED' | 'REJECTED'
  reason?: string
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
}

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  VERIFIED: 'Đã xác minh',
  REJECTED: 'Bị từ chối',
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  OPEN: 'Đang mở',
  MATCHED: 'Đã ghép',
  CLOSED: 'Đã đóng',
  EXPIRED: 'Hết hạn',
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: 'Chờ phụ huynh',
  ACCEPTED: 'Được chọn',
  REJECTED: 'Bị từ chối',
  WITHDRAWN: 'Đã rút',
}

export const EDUCATION_LABEL: Record<string, string> = {
  STUDENT: 'Sinh viên',
  BACHELOR: 'Cử nhân',
  MASTER: 'Thạc sĩ',
  PHD: 'Tiến sĩ',
  TEACHER: 'Giáo viên',
}

export const MODE_LABEL: Record<TeachingMode, string> = {
  ONLINE: 'Online',
  AT_HOME: 'Tại nhà',
  BOTH: 'Online & tại nhà',
}

export const SESSION_MODE_LABEL: Record<SessionMode, string> = {
  ONLINE: 'Online',
  AT_HOME: 'Tại nhà',
}

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  ID_CARD: 'CCCD / Chứng minh thư',
  DEGREE: 'Bằng cấp',
  STUDENT_CARD: 'Thẻ sinh viên',
  CERTIFICATE: 'Chứng chỉ',
}

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Hợp lệ',
  REJECTED: 'Không hợp lệ',
}

export const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  PENDING_VERIFICATION: 'Chờ xác minh email',
  ACTIVE: 'Hoạt động',
  SUSPENDED: 'Tạm khóa',
  DELETED: 'Đã xóa',
}

export const ROLE_LABEL: Record<Role, string> = {
  PARENT: 'Phụ huynh',
  TUTOR: 'Gia sư',
  ADMIN: 'Quản trị',
}

export const REPORT_TARGET_LABEL: Record<string, string> = {
  USER: 'Người dùng',
  REVIEW: 'Đánh giá',
  BOOKING: 'Buổi học',
  MESSAGE: 'Tin nhắn',
}

export const NOTIFICATION_LABEL: Record<string, string> = {
  APPLICATION_RECEIVED: 'Có gia sư ứng tuyển',
  APPLICATION_ACCEPTED: 'Đơn ứng tuyển được chọn',
  APPLICATION_REJECTED: 'Đơn ứng tuyển bị từ chối',
  BOOKING_CREATED: 'Yêu cầu đặt lịch mới',
  BOOKING_CONFIRMED: 'Buổi học đã xác nhận',
  BOOKING_CANCELLED: 'Buổi học đã hủy',
  BOOKING_COMPLETED: 'Buổi học hoàn thành',
  BOOKING_NO_SHOW: 'Buổi học vắng mặt',
  TUTOR_VERIFIED: 'Hồ sơ gia sư đã xác minh',
  TUTOR_REJECTED: 'Hồ sơ gia sư bị từ chối',
  DOCUMENT_APPROVED: 'Giấy tờ hợp lệ',
  DOCUMENT_REJECTED: 'Giấy tờ không hợp lệ',
}
