import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { MailCheck, TriangleAlert } from 'lucide-react'
import { forgotPassword } from '../../api/auth'
import { ApiClientError } from '../../api/client'
import { Button, Card, Input } from '../../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    // Luôn 204 kể cả email lạ (chống dò email), nên UI bắt buộc dùng câu chữ trung lập.
    mutationFn: () => forgotPassword(email.trim()),
    onSuccess: () => {
      setError(null)
      setSubmittedEmail(email.trim())
    },
    onError: (err) => {
      // Chỉ có thể lộ ra ngoài là 422 RATE_LIMITED (giới hạn theo IP, không có Retry-After).
      if (err instanceof ApiClientError && (err.code === 'RATE_LIMITED' || err.status === 422)) {
        setError('Bạn đã gửi quá nhiều yêu cầu. Hãy đợi khoảng một phút rồi thử lại.')
      }
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mutation.isPending) return
    if (!EMAIL_RE.test(email.trim())) {
      setError('Email không hợp lệ.')
      return
    }
    setError(null)
    mutation.mutate()
  }

  if (submittedEmail) {
    return (
      <div className="mx-auto max-w-md py-8">
        <Card>
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <MailCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Kiểm tra hộp thư của bạn</h1>
              <p className="mt-1 text-sm text-slate-500">
                Nếu email <span className="font-medium text-slate-700">{submittedEmail}</span> tồn tại trên TutorHub, liên
                kết đặt lại mật khẩu đã được gửi. Hãy mở thư và làm theo hướng dẫn trong vòng 60 phút.
              </p>
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            {import.meta.env.DEV && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Môi trường dev: email được giữ trong{' '}
                <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="font-medium text-brand-600 underline">
                  Mailpit (http://localhost:8025)
                </a>
                . Liên kết đặt lại có dạng{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/reset-password?token=...</code>
              </p>
            )}

            <div className="space-y-2 pt-1">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => mutation.mutate()}
                loading={mutation.isPending}
              >
                Gửi lại yêu cầu
              </Button>
              <Link to="/login" className="block text-sm font-medium text-brand-600 hover:text-brand-700">
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Quên mật khẩu</h1>
        <p className="mt-1 text-sm text-slate-500">Nhập email để nhận liên kết đặt lại mật khẩu.</p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint={error ?? 'Mỗi địa chỉ chỉ yêu cầu được vài lần trong một phút.'}
            className={error ? 'border-red-400' : undefined}
          />
          <Button type="submit" className="w-full" loading={mutation.isPending} disabled={!email.trim()}>
            Gửi liên kết đặt lại
          </Button>
          <p className="text-center text-xs text-slate-500">
            Vì lý do bảo mật, hệ thống không cho biết email này có tài khoản hay không.
          </p>
          <Link to="/login" className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700">
            Về đăng nhập
          </Link>
        </form>
      </Card>
    </div>
  )
}
