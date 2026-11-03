import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { KeyRound, MailWarning, ShieldAlert, TriangleAlert } from 'lucide-react'
import { dashboardPathForRole, useAuth } from '../../auth/AuthContext'
import { resendVerification } from '../../api/auth'
import { ApiClientError } from '../../api/client'
import { Button, Card, Input } from '../../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Backend phân loại lỗi đăng nhập bằng message tiếng Anh (AuthService.login):
 * "Invalid email or password" | "Email is not verified" | "Account is suspended",
 * còn giới hạn tần suất trả 422 code RATE_LIMITED "Too many requests".
 */
type LoginProblem = 'invalid' | 'unverified' | 'suspended' | 'rate_limited' | null

function classifyLoginError(error: unknown): LoginProblem {
  if (!(error instanceof ApiClientError)) return 'invalid'
  const code = error.code.toUpperCase()
  const message = error.message.toLowerCase()
  if (code === 'RATE_LIMITED' || message.includes('too many requests')) return 'rate_limited'
  if (message.includes('suspend') || (code === 'FORBIDDEN' && message.includes('account'))) return 'suspended'
  if (message.includes('not verified')) return 'unverified'
  return 'invalid'
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<LoginProblem>(null)
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({})

  const from = (location.state as { from?: string } | null)?.from
  const target = from ?? dashboardPathForRole(user?.role)

  const loginMutation = useMutation({
    // /auth/login chỉ trả token; AuthContext gọi thêm /users/me nên đây là User thật.
    mutationFn: () => login({ email: email.trim(), password }),
    onSuccess: (me) => navigate(from ?? dashboardPathForRole(me.role), { replace: true }),
    onError: (error) => setProblem(classifyLoginError(error)),
  })

  const resendMutation = useMutation({
    mutationFn: () => resendVerification(email.trim()),
    onSuccess: () => toast.success('Đã gửi lại email xác minh. Hãy kiểm tra hộp thư.'),
    // Email chưa đăng ký: backend trả 404 "User not found" — toast toàn cục đã nêu rõ.
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (loginMutation.isPending) return
    const next: { email?: string; password?: string } = {}
    if (!EMAIL_RE.test(email.trim())) next.email = 'Email không hợp lệ'
    else if (email.trim().length > 120) next.email = 'Email tối đa 120 ký tự'
    if (!password) next.password = 'Vui lòng nhập mật khẩu'
    setFormErrors(next)
    if (Object.keys(next).length > 0) return
    setProblem(null)
    loginMutation.mutate()
  }

  // Đã đăng nhập thì không lý do gì ở lại trang login.
  if (user) return <Navigate to={target} replace />

  const canResend = EMAIL_RE.test(email.trim()) && !resendMutation.isPending

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Đăng nhập TutorHub</h1>
        <p className="mt-1 text-sm text-slate-500">Kết nối với gia sư và phụ huynh trên toàn quốc.</p>
      </div>

      {problem === 'unverified' && (
        <Notice tone="amber" icon={<MailWarning className="size-4" />} title="Email chưa được xác minh">
          <p>Bạn cần bấm vào liên kết trong email xác minh trước khi đăng nhập.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5"
              disabled={!canResend}
              loading={resendMutation.isPending}
              onClick={() => resendMutation.mutate()}
            >
              Gửi lại email xác minh
            </Button>
            <DevMailboxHint className="text-xs font-medium text-brand-600 underline" />
          </div>
        </Notice>
      )}

      {problem === 'suspended' && (
        <Notice tone="red" icon={<ShieldAlert className="size-4" />} title="Tài khoản bị tạm khóa">
          <p>Tài khoản của bạn bị khóa bởi quản trị viên. Hãy liên hệ hỗ trợ TutorHub để được mở lại.</p>
        </Notice>
      )}

      {problem === 'rate_limited' && (
        <Notice tone="amber" icon={<TriangleAlert className="size-4" />} title="Bạn thử quá nhiều lần">
          <p>Vì lý do an toàn, hãy đợi khoảng một phút rồi đăng nhập lại.</p>
        </Notice>
      )}

      {problem === 'invalid' && (
        <Notice tone="red" icon={<KeyRound className="size-4" />} title="Không đăng nhập được">
          <p>Email hoặc mật khẩu chưa đúng. Kiểm tra lại lỗi gõ phím hoặc dùng liên kết quên mật khẩu.</p>
        </Notice>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint={formErrors.email}
            className={formErrors.email ? 'border-red-400' : undefined}
          />
          <Input
            label="Mật khẩu"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={formErrors.password}
            className={formErrors.password ? 'border-red-400' : undefined}
          />
          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
              Quên mật khẩu?
            </Link>
            <Link to="/verify-email" className="text-slate-500 hover:text-brand-600">
              Tôi đã có mã xác minh
            </Link>
          </div>
          <Button
            type="submit"
            className="w-full"
            loading={loginMutation.isPending}
            disabled={!email.trim() || !password}
          >
            Đăng nhập
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  )
}

function DevMailboxHint({ className }: { className?: string }) {
  if (!import.meta.env.DEV) return null
  return (
    <a href="http://localhost:8025" target="_blank" rel="noreferrer" className={className}>
      Mở Mailpit (dev)
    </a>
  )
}

function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'amber' | 'red'
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  const styles =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-800'
  return (
    <div className={`rounded-xl border p-4 text-sm ${styles}`}>
      <p className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
