import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { GraduationCap, MailCheck, MailWarning, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../../auth/AuthContext'
import { resendVerification } from '../../api/auth'
import { ApiClientError } from '../../api/client'
import type { RegisterResult, Role } from '../../api/types'
import { Button, Card, Input } from '../../components/ui'

type RegisterRole = Extract<Role, 'PARENT' | 'TUTOR'>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Server chỉ đặt @Size(min = 8, max = 72) cho mật khẩu — không ép thêm luật riêng.
const PHONE_RE = /^\+?[0-9][0-9\s.-]{6,19}$/

const LIMITS = { email: 120, fullName: 120, phone: 20, passwordMin: 8, passwordMax: 72 }

type Errors = Partial<Record<'email' | 'password' | 'confirm' | 'fullName' | 'phone', string>>

export default function RegisterPage() {
  const { register } = useAuth()
  const [role, setRole] = useState<RegisterRole>('PARENT')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [done, setDone] = useState<RegisterResult | null>(null)

  const mutation = useMutation({
    // 201 + { userId, message } — KHÔNG có token, nên chưa đăng nhập và không chuyển trang.
    mutationFn: () =>
      register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
      }),
    onSuccess: (result) => setDone(result),
    onError: (error) => {
      // Payload sai chỉ trả 400 VALIDATION_ERROR không kèm tên field, nên mọi bước kiểm tra đều làm ở client.
      if (error instanceof ApiClientError && error.code === 'EMAIL_EXISTS') {
        setErrors((prev) => ({ ...prev, email: 'Email này đã có tài khoản, hãy đăng nhập.' }))
      }
    },
  })

  function validate(): Errors {
    const next: Errors = {}
    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName) next.fullName = 'Vui lòng nhập họ và tên'
    else if (trimmedName.length > LIMITS.fullName) next.fullName = `Họ và tên tối đa ${LIMITS.fullName} ký tự`

    if (!trimmedEmail) next.email = 'Vui lòng nhập email'
    else if (!EMAIL_RE.test(trimmedEmail)) next.email = 'Email không hợp lệ'
    else if (trimmedEmail.length > LIMITS.email) next.email = `Email tối đa ${LIMITS.email} ký tự`

    if (!password) next.password = 'Vui lòng nhập mật khẩu'
    else if (password.length < LIMITS.passwordMin) next.password = `Mật khẩu cần tối thiểu ${LIMITS.passwordMin} ký tự`
    else if (password.length > LIMITS.passwordMax) next.password = `Mật khẩu tối đa ${LIMITS.passwordMax} ký tự`

    if (confirm !== password) next.confirm = 'Mật khẩu nhập lại không khớp'

    if (trimmedPhone) {
      if (trimmedPhone.length > LIMITS.phone) next.phone = `Số điện thoại tối đa ${LIMITS.phone} ký tự`
      else if (!PHONE_RE.test(trimmedPhone)) next.phone = 'Số điện thoại chỉ gồm chữ số, có thể bắt đầu bằng +84'
    }
    return next
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mutation.isPending) return
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length === 0) mutation.mutate()
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8">
        <Card>
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <MailCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Đã tạo tài khoản {ROLE_COPY[role].label}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Tài khoản #{done.userId} đã được tạo. Chúng tôi đã gửi email xác minh tới{' '}
                <span className="font-medium text-slate-700">{email.trim()}</span>. Đăng ký chưa tạo phiên đăng nhập — bạn
                phải xác minh email rồi tự đăng nhập.
              </p>
            </div>

            <ol className="space-y-1.5 rounded-lg bg-slate-50 px-4 py-3 text-left text-sm text-slate-600">
              <li>1. Mở hộp thư (hoặc Mailpit ở môi trường dev) và lấy liên kết xác minh.</li>
              <li>2. Dán liên kết đó vào trình duyệt để kích hoạt tài khoản.</li>
              <li>3. Bấm “Đăng nhập ngay” bên dưới và dùng email + mật khẩu vừa đặt.</li>
            </ol>

            {role === 'TUTOR' && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-left text-xs text-brand-700">
                Với gia sư: sau khi đăng nhập, hoàn thiện hồ sơ và gửi xét duyệt ở mục “Hồ sơ của tôi” thì phụ huynh mới
                có thể đặt lịch.
              </p>
            )}

            <ResendVerification email={email.trim()} />

            <Link
              to="/login"
              className="inline-block w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </Card>
        <p className="text-center text-sm text-slate-600">
          Cần đổi thông tin?{' '}
          <button
            type="button"
            onClick={() => {
              setDone(null)
              setErrors({})
            }}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Quay lại form đăng ký
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Đăng ký TutorHub</h1>
        <p className="mt-1 text-sm text-slate-500">Miễn phí tạo tài khoản cho phụ huynh và gia sư.</p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Bạn là</span>
            <div className="grid grid-cols-2 gap-3">
              <RoleOption
                active={role === 'PARENT'}
                onClick={() => setRole('PARENT')}
                icon={<Users className="size-5" />}
                label="Phụ huynh"
                description="Tìm và đặt lịch gia sư cho con"
              />
              <RoleOption
                active={role === 'TUTOR'}
                onClick={() => setRole('TUTOR')}
                icon={<GraduationCap className="size-5" />}
                label="Gia sư"
                description="Dạy kèm, nhận yêu cầu từ phụ huynh"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Hệ thống không cho tự đăng ký tài khoản quản trị — chỉ nhận phụ huynh hoặc gia sư.
            </p>
          </div>

          <Input
            label="Họ và tên"
            autoComplete="name"
            maxLength={LIMITS.fullName}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            hint={errors.fullName}
            className={errors.fullName ? 'border-red-400' : undefined}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            maxLength={LIMITS.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint={errors.email ?? 'Dùng email này để đăng nhập và nhận thông báo.'}
            className={errors.email ? 'border-red-400' : undefined}
          />
          <Input
            label="Số điện thoại (không bắt buộc)"
            type="tel"
            autoComplete="tel"
            maxLength={LIMITS.phone}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            hint={errors.phone}
            className={errors.phone ? 'border-red-400' : undefined}
          />
          <Input
            label="Mật khẩu"
            type="password"
            autoComplete="new-password"
            maxLength={LIMITS.passwordMax}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={errors.password ?? `${LIMITS.passwordMin}–${LIMITS.passwordMax} ký tự`}
            className={errors.password ? 'border-red-400' : undefined}
          />
          <Input
            label="Nhập lại mật khẩu"
            type="password"
            autoComplete="new-password"
            maxLength={LIMITS.passwordMax}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            hint={errors.confirm}
            className={errors.confirm ? 'border-red-400' : undefined}
          />

          {role === 'TUTOR' && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              Sau khi xác minh email và đăng nhập, gia sư cần hoàn thiện hồ sơ rồi gửi xét duyệt ở mục Hồ sơ của tôi
              trước khi nhận lịch học.
            </p>
          )}

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Chúng tôi sẽ gửi email xác minh. Bạn vẫn phải bấm liên kết trong email rồi tự đăng nhập — đăng ký chưa tạo
            phiên đăng nhập.
          </p>

          <Button type="submit" className="w-full" loading={mutation.isPending}>
            Tạo tài khoản
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-slate-600">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}

const ROLE_COPY: Record<RegisterRole, { label: string }> = {
  PARENT: { label: 'Phụ huynh' },
  TUTOR: { label: 'Gia sư' },
}

function ResendVerification({ email }: { email: string }) {
  const resend = useMutation({
    mutationFn: () => resendVerification(email),
    onSuccess: () => toast.success('Đã gửi lại email xác minh. Hãy kiểm tra hộp thư.'),
  })

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
      <Button
        type="button"
        variant="secondary"
        className="px-3 py-1.5"
        loading={resend.isPending}
        onClick={() => resend.mutate()}
      >
        <MailWarning className="size-4" /> Gửi lại email xác minh
      </Button>
      {import.meta.env.DEV && (
        <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 underline">
          Mở Mailpit (dev)
        </a>
      )}
    </div>
  )
}

function RoleOption({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50',
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <span className="text-xs font-normal text-slate-500">{description}</span>
    </button>
  )
}
