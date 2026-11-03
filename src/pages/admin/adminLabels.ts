import { STATUS_TONE } from '../../lib/labels'
import { showApiError } from '../../lib/useMutationErrorToast'

/**
 * Size trang dùng chung cho mọi bảng admin. Backend ép `size` trong khoảng 1–100
 * (Math.clamp trong AdminController/TutorAdminController) và giữ nguyên `page` nếu page >= 0.
 */
export const ADMIN_PAGE_SIZE = 20

/** Mirror TutorDecisionRequest/DocumentReviewRequest: reason @Size(max = 500). */
export const REASON_MAX = 500

/** Mirror ResolveReportRequest: resolution @NotBlank @Size(max = 1000). */
export const RESOLUTION_MAX = 1000

export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'slate'

/**
 * action là chuỗi tự do do backend ghi, nên nhãn chỉ liệt kê các giá trị thực sự tồn tại:
 * - AdminService.setUserStatus: "USER_" + status => USER_SUSPENDED / USER_ACTIVE
 * - AdminService.resolve: REPORT_RESOLVED, AdminService.hideReview: REVIEW_HIDDEN
 * - TutorAdminService: TUTOR_VERIFIED, TUTOR_REJECTED, "DOCUMENT_" + status => DOCUMENT_APPROVED / DOCUMENT_REJECTED
 * - BookingService.action: "BOOKING_" + trạng thái đích => BOOKING_CONFIRMED / _COMPLETED / _CANCELLED / _NO_SHOW
 * Giá trị lạ sẽ rơi về nhãn gốc (fallback) thay vì bị ẩn.
 */
const AUDIT_ACTION_LABEL: Record<string, string> = {
  USER_SUSPENDED: 'Tạm khóa người dùng',
  USER_ACTIVE: 'Kích hoạt lại người dùng',
  TUTOR_VERIFIED: 'Duyệt hồ sơ gia sư',
  TUTOR_REJECTED: 'Từ chối hồ sơ gia sư',
  DOCUMENT_APPROVED: 'Chấp thuận giấy tờ',
  DOCUMENT_REJECTED: 'Bác bỏ giấy tờ',
  REPORT_RESOLVED: 'Xử lý báo cáo',
  REVIEW_HIDDEN: 'Ẩn đánh giá',
  BOOKING_CONFIRMED: 'Xác nhận buổi học',
  BOOKING_COMPLETED: 'Hoàn thành buổi học',
  BOOKING_CANCELLED: 'Hủy buổi học',
  BOOKING_NO_SHOW: 'Buổi học vắng mặt',
}

/** entity_type cũng là chuỗi tự do; các giá trị sau do admin/* và booking/* ghi vào. */
const AUDIT_ENTITY_LABEL: Record<string, string> = {
  USER: 'Người dùng',
  TUTOR: 'Hồ sơ gia sư',
  TUTOR_DOCUMENT: 'Giấy tờ gia sư',
  REPORT: 'Báo cáo',
  REVIEW: 'Đánh giá',
  BOOKING: 'Buổi học',
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action
}

export function auditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABEL[entityType] ?? entityType
}

/** Trạng thái báo cáo là chuỗi (OPEN/RESOLVED/DISMISSED) nên không có Record an toàn theo khóa. */
export function toneFor(status: string): Tone {
  return STATUS_TONE[status] ?? 'slate'
}

/**
 * AdminUser chỉ có tên trong danh sách người dùng; backend không có endpoint tra tên theo id
 * cho reporterId/actorId, vì vậy mọi tham chiếu id hiển thị thô dạng "Người dùng #123".
 */
export function userRefLabel(id: number | null): string {
  return id == null ? 'Không rõ' : `Người dùng #${id}`
}

export function entityRefLabel(entityType: string, entityId: number | null): string {
  const label = auditEntityLabel(entityType)
  return entityId == null ? label : `${label} #${entityId}`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

/**
 * Toast lỗi toàn cầu (MutationErrorToaster) chỉ theo dõi mutation cache, nên query lỗi phải tự báo.
 * Dùng cho nút "Thử lại" ở các panel admin.
 */
export function notifyQueryError(result: { isError: boolean; error: unknown }): void {
  if (result.isError) showApiError(result.error)
}
