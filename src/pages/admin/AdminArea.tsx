import { Route, Routes } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABEL } from '../../lib/labels'
import { Badge, EmptyState } from '../../components/ui'
import AdminDashboard from './AdminDashboard'
import PendingTutorsPanel from './PendingTutorsPanel'
import UsersPanel from './UsersPanel'
import ReportsPanel from './ReportsPanel'
import AuditPanel from './AuditPanel'

/**
 * Điều hướng sang các panel nằm ở cột trái (nhánh "Quản trị" trong AppLayout) nên ở đây chỉ còn
 * phần nội dung. Route con tương đối vì App.tsx mount <AdminArea /> tại "admin/*".
 */
export default function AdminArea() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bảng điều khiển quản trị</h1>
          <p className="mt-1 text-sm text-slate-500">
            Duyệt hồ sơ gia sư, khóa tài khoản, xử lý báo cáo và xem nhật ký hoạt động.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <ShieldCheck className="size-4 text-brand-600" />
          <span className="font-medium text-slate-800">{user ? user.fullName : 'Quản trị viên'}</span>
          {user?.email && <span className="text-slate-400">· {user.email}</span>}
          {user && <Badge tone="blue">{ROLE_LABEL[user.role]}</Badge>}
        </div>
      </header>

      <section className="min-w-0">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="tutors" element={<PendingTutorsPanel />} />
          <Route path="users" element={<UsersPanel />} />
          <Route path="reports" element={<ReportsPanel />} />
          <Route path="audit" element={<AuditPanel />} />
          <Route
            path="*"
            element={<EmptyState>Đường dẫn quản trị không tồn tại. Hãy chọn một mục ở cột điều hướng bên trái.</EmptyState>}
          />
        </Routes>
      </section>
    </div>
  )
}
