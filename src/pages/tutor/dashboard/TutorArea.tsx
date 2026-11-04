import { Link, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Upload,
} from 'lucide-react'
import { fetchMyTutorProfile } from '../../../api/tutor'
import type { VerificationStatus } from '../../../api/types'
import { STATUS_TONE, VERIFICATION_STATUS_LABEL } from '../../../lib/labels'
import { Badge, EmptyState, Spinner } from '../../../components/ui'
import ProfileTab from './ProfileTab'
import SubjectsTab from './SubjectsTab'
import AvailabilityTab from './AvailabilityTab'
import DocumentsTab from './DocumentsTab'
import AccountTab from './AccountTab'

/** Hướng dẫn việc cần làm tiếp theo theo từng trạng thái duyệt. */
const BANNER: Record<VerificationStatus, { cls: string; icon: typeof Clock; title: string; body: string; cta?: { to: string; label: string } }> = {
  DRAFT: {
    cls: 'border-slate-200 bg-slate-50 text-slate-900',
    icon: Upload,
    title: 'Hồ sơ đang là bản nháp — phụ huynh chưa tìm thấy bạn',
    body: 'Hoàn thiện tiêu đề, trình độ, học phí ở mục Hồ sơ; thêm ít nhất một môn dạy; tải giấy tờ CCCD/CMND rồi bấm “Nộp hồ sơ duyệt” ở mục Giấy tờ.',
    cta: { to: '/tutor/documents', label: 'Kiểm tra điều kiện và nộp hồ sơ' },
  },
  PENDING: {
    cls: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: Clock,
    title: 'Đang chờ admin duyệt',
    body: 'Hồ sơ đã được gửi và tạm khóa — bạn không thể chỉnh sửa cho tới khi có kết quả. Việc thường mất 24–48 giờ.',
  },
  VERIFIED: {
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: CheckCircle2,
    title: 'Hồ sơ đã xác minh — đang công khai',
    body: 'Phụ huynh đã có thể tìm thấy, ứng tuyển và đặt lịch với bạn. Cập nhật lịch rảnh thường xuyên để nhận thêm yêu cầu.',
  },
  REJECTED: {
    cls: 'border-red-200 bg-red-50 text-red-900',
    icon: AlertTriangle,
    title: 'Hồ sơ bị từ chối',
    body: 'Kiểm tra lại thông tin ở mục Hồ sơ và giấy tờ ở mục Giấy tờ (giấy tờ chưa hợp lệ sẽ hiển thị trạng thái “Không hợp lệ”), sửa xong rồi nộp lại để được xét duyệt.',
    cta: { to: '/tutor/documents', label: 'Mở mục Giấy tờ' },
  },
}

export default function TutorArea() {
  const profileQuery = useQuery({ queryKey: ['tutor', 'me'], queryFn: fetchMyTutorProfile })
  const profile = profileQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Khu vực gia sư</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hoàn thiện hồ sơ, cập nhật môn dạy và lịch rảnh để phụ huynh tìm thấy bạn.
          </p>
        </div>
        {profile && <Badge tone={STATUS_TONE[profile.verificationStatus]}>{VERIFICATION_STATUS_LABEL[profile.verificationStatus]}</Badge>}
      </div>

      {profileQuery.isError && (
        <EmptyState>Không tải được hồ sơ của bạn. Hãy thử tải lại trang hoặc đăng nhập lại.</EmptyState>
      )}

      {profileQuery.isLoading && <Spinner />}

      {profile && <StatusBanner status={profile.verificationStatus} publicProfileId={profile.userId} />}

      {/* Điều hướng giữa các trang hồ sơ nằm ở sidebar (Gia sư > Hồ sơ của tôi) nên khu vực này chỉ còn nội dung. */}
      <section className="min-w-0">
        <Routes>
          <Route index element={<ProfileTab />} />
          <Route path="subjects" element={<SubjectsTab />} />
          <Route path="availability" element={<AvailabilityTab />} />
          <Route path="documents" element={<DocumentsTab />} />
          <Route path="account" element={<AccountTab />} />
        </Routes>
      </section>
    </div>
  )
}

function StatusBanner({ status, publicProfileId }: { status: VerificationStatus; publicProfileId: number }) {
  const banner = BANNER[status]
  const Icon = banner.icon

  return (
    <div className={clsx('rounded-xl border px-5 py-4 shadow-sm', banner.cls)}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{banner.title}</p>
          <p className="text-sm opacity-90">{banner.body}</p>
          <div className="flex flex-wrap gap-4 pt-1">
            {banner.cta && (
              <Link to={banner.cta.to} className="text-sm font-semibold underline-offset-2 hover:underline">
                {banner.cta.label} →
              </Link>
            )}
            {status === 'VERIFIED' && (
              <Link
                to={`/tutors/${publicProfileId}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-2 hover:underline"
              >
                <ExternalLink className="size-4" /> Xem trang hồ sơ công khai
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
