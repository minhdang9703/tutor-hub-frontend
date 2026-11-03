import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { resendVerification, verifyEmail } from '../../api/auth'
import { Button, Card, Input, Spinner } from '../../components/ui'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  // POST /auth/verify-email dùng token một lần (token.use()), nên chỉ gọi đúng một lượt.
  // Ref theo token chặn React StrictMode invoke effect hai lần ở chế độ dev.
  const startedForRef = useRef<string | null>(null)

  const verify = useMutation({ mutationFn: () => verifyEmail(token) })
  // `mutate` của TanStack Query v5 có tham chiếu ổn định nên an toàn khi đưa vào deps.
  const { mutate: runVerification } = verify

  useEffect(() => {
    if (!token || startedForRef.current === token) return
    startedForRef.current = token
    runVerification()
  }, [token, runVerification])

  return (
    <div className="mx-auto max-w-md py-10">
      {!token ? (
        <Result tone="error" title="Liên kết không hợp lệ">
          <p>Đường dẫn xác minh thiếu mã token. Hãy dán nguyên liên kết trong email vào trình duyệt hoặc gửi lại email.</p>
          <ResendForm />
          <LoginLink />
        </Result>
      ) : verify.isPending ? (
        <Card>
          <div className="space-y-3 text-center">
            <Spinner />
            <p className="text-sm text-slate-600">Đang xác minh email của bạn...</p>
          </div>
        </Card>
      ) : verify.isSuccess ? (
        <Result tone="success" title="Xác minh email thành công">
          <p>Email của bạn đã được kích hoạt. Bạn có thể đăng nhập và bắt đầu sử dụng TutorHub.</p>
          <Link
            to="/login"
            className="mt-1 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Đi tới đăng nhập
          </Link>
        </Result>
      ) : (
        <Result tone="error" title="Không thể xác minh email">
          <p>
            {verify.error instanceof Error && verify.error.message
              ? verify.error.message
              : 'Liên kết có thể đã hết hạn hoặc đã được sử dụng.'}{' '}
            Mã xác minh chỉ dùng được một lần trong 60 phút — vui lòng gửi lại yêu cầu.
          </p>
          <ResendForm />
          <LoginLink />
        </Result>
      )}
    </div>
  )
}

function Result({ tone, title, children }: { tone: 'success' | 'error'; title: string; children: ReactNode }) {
  return (
    <Card>
      <div className="space-y-3 text-center">
        <div
          className={
            'mx-auto flex size-12 items-center justify-center rounded-full ' +
            (tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')
          }
        >
          {tone === 'success' ? <ShieldCheck className="size-6" /> : <ShieldX className="size-6" />}
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <div className="text-sm text-slate-500">{children}</div>
      </div>
    </Card>
  )
}

function ResendForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resend = useMutation({
    mutationFn: () => resendVerification(email.trim()),
    onSuccess: () => {
      setError(null)
      toast.success('Đã gửi lại email xác minh. Hãy kiểm tra hộp thư.')
    },
    // Khác /forgot-password, endpoint này trả 404 "User not found" cho email lạ.
    onError: () => setError('Không gửi được cho email này. Kiểm tra lại địa chỉ hoặc đăng ký tài khoản mới.'),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (resend.isPending || !email.trim()) return
    resend.mutate()
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-2 max-w-sm space-y-3 text-left" noValidate>
      <Input
        label="Email của bạn"
        type="email"
        autoComplete="email"
        maxLength={120}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint={error ?? undefined}
        className={error ? 'border-red-400' : undefined}
      />
      <Button type="submit" variant="secondary" className="w-full" loading={resend.isPending} disabled={!email.trim()}>
        Gửi lại email xác minh
      </Button>
      {import.meta.env.DEV && (
        <p className="text-center text-xs text-slate-400">
          Dev: mở{' '}
          <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="text-brand-600 underline">
            Mailpit
          </a>{' '}
          để xem email, rồi mở liên kết{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/verify-email?token=...</code>
        </p>
      )}
    </form>
  )
}

function LoginLink() {
  return (
    <p className="pt-1 text-sm">
      <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
        Quay lại đăng nhập
      </Link>
    </p>
  )
}
