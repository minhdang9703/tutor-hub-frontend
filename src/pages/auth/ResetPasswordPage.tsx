import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldX } from 'lucide-react'
import { resetPassword } from '../../api/auth'
import { ApiClientError } from '../../api/client'
import { Button, Card, EmptyState, Input } from '../../components/ui'

// Server: @Size(min = 8, max = 72) cho newPassword, token là @NotBlank.
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tokenInvalid, setTokenInvalid] = useState(false)

  const mutation = useMutation({
    // 204 + thu hồi toàn bộ refresh token phía server; api/auth.ts đã xóa token cục bộ.
    mutationFn: () => resetPassword(token, password),
    onSuccess: () => {
      toast.success('Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.')
      navigate('/login', { replace: true })
    },
    // Liên kết sai/hết hạn: giữ người dùng ở trang này kèm hướng dẫn, toast toàn cục vẫn chạy.
    onError: (error) => {
      if (error instanceof ApiClientError && /token/i.test(`${error.code} ${error.message}`)) setTokenInvalid(true)
    },
  })

  if (!token) {
    return (
      <div className="mx-auto max-w-md py-8">
        <EmptyState>
          Liên kết đặt lại mật khẩu không hợp lệ (thiếu mã token).
          <div className="mt-3">
            <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
              Yêu cầu liên kết mới
            </Link>
          </div>
        </EmptyState>
      </div>
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mutation.isPending) return
    const next: Record<string, string> = {}
    if (!password) next.password = 'Vui lòng nhập mật khẩu mới'
    else if (password.length < PASSWORD_MIN) next.password = `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự`
    else if (password.length > PASSWORD_MAX) next.password = `Mật khẩu tối đa ${PASSWORD_MAX} ký tự`
    if (!confirm) next.confirm = 'Vui lòng nhập lại mật khẩu'
    else if (confirm !== password) next.confirm = 'Mật khẩu nhập lại không khớp'
    setErrors(next)
    if (Object.keys(next).length === 0) mutation.mutate()
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Đặt lại mật khẩu</h1>
        <p className="mt-1 text-sm text-slate-500">Tạo mật khẩu mới cho tài khoản của bạn.</p>
      </div>

      {tokenInvalid && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <ShieldX className="mt-0.5 size-4 shrink-0" />
          <p>
            Liên kết đã hết hạn hoặc đã được dùng (mã chỉ có hiệu lực 60 phút và chỉ dùng một lần). Vui lòng{' '}
            <Link to="/forgot-password" className="font-medium underline">
              yêu cầu liên kết mới
            </Link>
            .
          </p>
        </div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={errors.password ?? `${PASSWORD_MIN}–${PASSWORD_MAX} ký tự`}
            className={errors.password ? 'border-red-400' : undefined}
          />
          <Input
            label="Nhập lại mật khẩu"
            type="password"
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            hint={errors.confirm}
            className={errors.confirm ? 'border-red-400' : undefined}
          />
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Sau khi đổi, mọi phiên đang đăng nhập trên các thiết bị khác sẽ bị đăng xuất.
          </p>
          <Button
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            disabled={!password || !confirm}
          >
            Đổi mật khẩu
          </Button>
          {mutation.isSuccess && <p className="text-center text-sm text-emerald-600">Đã đổi mật khẩu, đang đưa bạn về trang đăng nhập...</p>}
          <Link to="/login" className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700">
            Về đăng nhập
          </Link>
        </form>
      </Card>
    </div>
  )
}
