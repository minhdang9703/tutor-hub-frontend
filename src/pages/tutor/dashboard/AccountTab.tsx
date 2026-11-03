import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ExternalLink, LogOut, Save, ShieldAlert, Upload } from 'lucide-react'
import { changePassword, deleteAccount, updateMe, uploadAvatar } from '../../../api/auth'
import { fetchMyTutorProfile } from '../../../api/tutor'
import { useAuth } from '../../../auth/AuthContext'
import { Button, Card, Input, Spinner } from '../../../components/ui'

const MIN_PASSWORD = 8
/** Bỏ khoảng trắng rồi kiểm tra số điện thoại Việt Nam (0... hoặc +84...). */
function normalizePhone(value: string): string {
  return value.replace(/[\s.]/g, '')
}
const PHONE_RE = /^(?:\+84|0)\d{9,10}$/

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  const first = parts[0] ?? ''
  return (parts.length > 1 ? first[0] + last[0] : last.slice(0, 2)).toUpperCase()
}

export default function AccountTab() {
  const { user, setUser, signOut, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const profileQuery = useQuery({ queryKey: ['tutor', 'me'], queryFn: fetchMyTutorProfile })

  // updateMe KHÔNG là patch từng phần: fullName bắt buộc, phone thiếu sẽ bị ghi null => luôn prefill đủ.
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')

  useEffect(() => {
    if (user) {
      setFullName(user.fullName)
      setPhone(user.phone ?? '')
    }
  }, [user])

  const saveMutation = useMutation({
    mutationFn: () => updateMe({ fullName: fullName.trim(), phone: normalizePhone(phone) || undefined }),
    onSuccess: (updated) => {
      setUser(updated)
      queryClient.invalidateQueries({ queryKey: ['tutor', 'me'] })
      toast.success('Đã cập nhật thông tin liên hệ.')
    },
  })

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: async () => {
      // Backend chỉ trả avatarKey (object key MinIO), không có URL hiển thị — phải lấy lại /users/me.
      await refreshUser()
      toast.success('Đã cập nhật ảnh đại diện.')
    },
  })

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: async () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      // changePassword thu hồi token ngay phía server nên phiên cục bộ không còn hợp lệ.
      toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại.')
      await signOut()
      navigate('/login', { replace: true })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: async () => {
      toast.success('Tài khoản đã bị xóa. Hẹn gặp lại bạn.')
      await signOut()
      navigate('/', { replace: true })
    },
  })

  if (!user) return <Spinner />

  const myProfile = profileQuery.data

  const phoneProblem = phone.trim() === '' || PHONE_RE.test(normalizePhone(phone)) ? null : 'Số điện thoại phải theo dạng 0123456789 hoặc +84123456789.'
  const canSave = fullName.trim().length > 0 && phoneProblem === null
  const passwordProblem =
    currentPassword.length === 0
      ? 'Nhập mật khẩu hiện tại.'
      : newPassword.length < MIN_PASSWORD
        ? `Mật khẩu mới cần tối thiểu ${MIN_PASSWORD} ký tự.`
        : newPassword === currentPassword
          ? 'Mật khẩu mới cần khác mật khẩu hiện tại.'
          : confirmPassword !== newPassword
            ? 'Mật khẩu nhập lại chưa khớp.'
            : null
  const canChangePassword = passwordProblem === null

  return (
    <div className="space-y-6">
      <Card title="Ảnh đại diện">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-50 text-2xl font-bold text-brand-600">
            {initialsOf(user.fullName)}
          </div>
          <div className="min-w-56 space-y-1.5">
            <Input
              aria-label="Chọn ảnh đại diện"
              type="file"
              accept="image/png,image/jpeg"
              disabled={avatarMutation.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) avatarMutation.mutate(file)
                e.target.value = ''
              }}
            />
            <p className="text-xs text-slate-500">Định dạng JPG/PNG, tối đa 5 MB.</p>
            <p className="text-xs text-slate-400">
              {user.avatarKey
                ? 'Đã có ảnh trong hệ thống. Trang danh sách gia sư vẫn hiển thị chữ viết tắt vì backend chưa cấp URL ảnh công khai.'
                : 'Chưa có ảnh — hệ thống hiển thị chữ viết tắt tên của bạn.'}
            </p>
          </div>
          {avatarMutation.isPending && (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Upload className="size-4 animate-pulse" /> Đang tải lên...
            </span>
          )}
        </div>
      </Card>

      <Card title="Thông tin liên hệ">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) saveMutation.mutate()
          }}
          className="space-y-4"
        >
          <Input label="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)} hint="Bắt buộc — dùng cho cả hồ sơ gia sư." />
          <Input
            label="Số điện thoại"
            type="tel"
            value={phone}
            hint="Không bắt buộc, nhưng phụ huynh cần để liên hệ trước buổi học."
            onChange={(e) => setPhone(e.target.value)}
          />
          {phoneProblem && <p className="text-sm text-red-600">{phoneProblem}</p>}
          <p className="text-xs text-slate-500">Email đăng nhập ({user.email}) không thể thay đổi.</p>
          <div className="flex justify-end">
            <Button type="submit" loading={saveMutation.isPending} disabled={!canSave}>
              <Save className="size-4" /> Lưu thay đổi
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Đổi mật khẩu">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canChangePassword) passwordMutation.mutate()
          }}
          className="space-y-4"
        >
          <Input
            label="Mật khẩu hiện tại"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            hint={`Tối thiểu ${MIN_PASSWORD} ký tự.`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {(currentPassword || newPassword || confirmPassword) && passwordProblem && (
            <p className="text-sm text-red-600">{passwordProblem}</p>
          )}
          <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <LogOut className="mt-0.5 size-3.5 shrink-0" />
            Sau khi đổi mật khẩu, phiên hiện tại bị đăng xuất và bạn sẽ được đưa về trang đăng nhập.
          </p>
          <div className="flex justify-end">
            <Button type="submit" loading={passwordMutation.isPending} disabled={!canChangePassword}>
              Đổi mật khẩu
            </Button>
          </div>
        </form>
      </Card>

      {myProfile?.verificationStatus === 'VERIFIED' && (
        <Card title="Trang hồ sơ công khai">
          <p className="mb-3 text-sm text-slate-600">Hồ sơ của bạn đã được xác minh và hiển thị với phụ huynh.</p>
          <Link
            to={`/tutors/${myProfile.userId}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
          >
            <ExternalLink className="size-4" /> Xem trang hồ sơ của tôi
          </Link>
        </Card>
      )}

      <Card title="Xóa tài khoản">
        <p className="mb-3 text-sm text-slate-600">
          Tài khoản sẽ bị khóa mềm: lịch học và đánh giá cũ vẫn được lưu cho phía phụ huynh, nhưng bạn không thể
          đăng nhập lại.
        </p>
        <div className="flex justify-end">
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm('Xóa tài khoản gia sư này? Hành động không thể hoàn tác.')) deleteMutation.mutate()
            }}
          >
            <ShieldAlert className="size-4" /> Xóa tài khoản
          </Button>
        </div>
      </Card>
    </div>
  )
}
