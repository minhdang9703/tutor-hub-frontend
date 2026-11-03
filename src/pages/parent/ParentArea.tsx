import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Inbox,
  MailWarning,
  MapPin,
  MessageSquare,
  Save,
  Search,
  UserCog,
} from 'lucide-react'
import { fetchDistricts } from '../../api/catalog'
import { updateMe } from '../../api/auth'
import { fetchMyParentProfile, updateMyParentProfile } from '../../api/parent'
import type { ParentProfile, User } from '../../api/types'
import { USER_STATUS_LABEL } from '../../lib/labels'
import { useAuth } from '../../auth/AuthContext'
import { Badge, Button, Card, EmptyState, Input, Select, Spinner } from '../../components/ui'
import ChildrenPanel from './ChildrenPanel'

// Mirror ParentProfileRequest: address @Size(max = 255), districtId là khóa ngoại nên chỉ lấy id từ /districts.
const ADDRESS_MAX = 255
// Mirror UpdateUserRequest: fullName @NotBlank @Size(max = 120), phone @Size(max = 20).
const NAME_MAX = 120
const PHONE_MAX = 20
const PHONE_RE = /^\+?[0-9][0-9\s.-]{6,19}$/

/** Link tới các trang do module khác sở hữu — chỉ đi đường dẫn, không import component của họ. */
const QUICK_LINKS = [
  { to: '/requests/mine', label: 'Yêu cầu tìm gia sư', hint: 'Xem đơn bạn đã gửi và ứng viên ứng tuyển', icon: Inbox },
  { to: '/bookings', label: 'Lịch học', hint: 'Theo dõi và xác nhận buổi học của con', icon: CalendarDays },
  { to: '/messages', label: 'Tin nhắn', hint: 'Trao đổi với gia sư về giờ giấc, giáo trình', icon: MessageSquare },
  { to: '/notifications', label: 'Thông báo', hint: 'Mọi hoạt động liên quan tới tài khoản', icon: Bell },
]

export default function ParentArea() {
  const { user, setUser } = useAuth()
  const profileQuery = useQuery({ queryKey: ['parent', 'me'], queryFn: fetchMyParentProfile })

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Hồ sơ phụ huynh</h1>
        <p className="text-sm text-slate-500">
          {user ? `${user.fullName} · ${user.email} · ` : ''}
          Địa chỉ và thông tin con giúp gia sư sắp xếp buổi học tại nhà chính xác hơn.
        </p>
        {user && user.status !== 'ACTIVE' && (
          <Badge tone={user.status === 'SUSPENDED' ? 'red' : 'amber'}>
            <MailWarning className="mr-1 size-3.5" />
            {USER_STATUS_LABEL[user.status]}
          </Badge>
        )}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Khu vực dạy học">
            {profileQuery.isLoading && <Spinner />}
            {profileQuery.isError && (
              <EmptyState>
                Không tải được hồ sơ. Kiểm tra backend TutorHub đang chạy tại{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code> rồi thử lại.
              </EmptyState>
            )}
            {profileQuery.data && (
              <ProfileForm
                key={`${profileQuery.data.userId}|${profileQuery.data.address ?? ''}|${profileQuery.data.districtId ?? ''}`}
                profile={profileQuery.data}
              />
            )}
          </Card>

          <Card title="Thông tin liên hệ">
            {user ? (
              <ContactForm
                key={`${user.id}|${user.fullName}|${user.phone ?? ''}`}
                user={user}
                onSaved={setUser}
              />
            ) : (
              <EmptyState>
                Chưa tải được thông tin tài khoản. Hãy tải lại trang hoặc{' '}
                <Link to="/login" className="font-medium text-brand-600 underline">
                  đăng nhập lại
                </Link>
                .
              </EmptyState>
            )}
          </Card>

          <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 text-sm text-brand-800">
            <p className="flex items-center gap-2 font-medium">
              <Search className="size-4" /> Sắp xếp buổi học đầu tiên?
            </p>
            <p className="mt-1 text-brand-700">Lọc gia sư theo môn, khối lớp và khu vực rồi gửi yêu cầu đặt lịch.</p>
            <Link to="/tutors" className="mt-3 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              Tìm gia sư <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <Card title="Con của tôi">
            <ChildrenPanel />
          </Card>

          <Card title="Tiện ích của phụ huynh">
            <ul className="divide-y divide-slate-100">
              {QUICK_LINKS.map(({ to, label, hint, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800 group-hover:text-brand-700">{label}</span>
                      <span className="block truncate text-xs text-slate-500">{hint}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-slate-400 group-hover:text-brand-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ProfileForm({ profile }: { profile: ParentProfile }) {
  const queryClient = useQueryClient()
  const districtsQuery = useQuery({ queryKey: ['catalog', 'districts'], queryFn: () => fetchDistricts() })
  // ParentArea gắn key theo dữ liệu hồ sơ đã tải nên form chỉ khởi tạo một lần — không cần effect đồng bộ.
  const [address, setAddress] = useState(profile.address ?? '')
  const [districtId, setDistrictId] = useState(profile.districtId != null ? String(profile.districtId) : '')
  const [error, setError] = useState<string | null>(null)

  const districts = districtsQuery.data ?? []
  const cities = [...new Set(districts.map((d) => d.city))]

  const mutation = useMutation({
    mutationFn: () =>
      updateMyParentProfile({
        // Bỏ trống = xóa dữ liệu: backend nhận null rồi ghi thẳng xuống cột tương ứng.
        address: address.trim() || undefined,
        districtId: districtId ? Number(districtId) : null,
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'me'] })
      setAddress(saved.address ?? '')
      setDistrictId(saved.districtId != null ? String(saved.districtId) : '')
      toast.success('Đã lưu khu vực học của gia đình.')
    },
  })

  function submit() {
    if (address.trim().length > ADDRESS_MAX) {
      setError(`Địa chỉ tối đa ${ADDRESS_MAX} ký tự.`)
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4"
    >
      <Input
        label="Địa chỉ liên hệ"
        placeholder="Số nhà, đường, phường/xã"
        value={address}
        maxLength={ADDRESS_MAX}
        onChange={(e) => setAddress(e.target.value)}
        hint={error ?? 'Dùng cho buổi học tại nhà và để gợi ý gia sư gần chỗ bạn.'}
        className={error ? 'border-red-400' : undefined}
      />

      {districtsQuery.isLoading ? (
        <Spinner />
      ) : (
        <Select
          label="Quận / Huyện"
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
          hint={
            districtsQuery.isError
              ? 'Chưa tải được danh sách quận/huyện — lưu hồ sơ vẫn được nếu bạn không đổi khu vực.'
              : 'Dùng để gợi ý gia sư gần nhà.'
          }
        >
          <option value="">— Chưa chọn —</option>
          {cities.map((city) => (
            <optgroup key={city} label={city}>
              {districts
                .filter((d) => d.city === city)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="size-4" />
          {districtId
            ? `Khu vực: ${districts.find((d) => String(d.id) === districtId)?.name ?? 'đang lưu'}`
            : 'Chưa chọn khu vực'}
        </p>
        <Button type="submit" loading={mutation.isPending}>
          <Save className="size-4" /> Lưu khu vực
        </Button>
      </div>
    </form>
  )
}

function ContactForm({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  // ParentArea gắn key theo user đã lưu nên form khởi tạo đúng một lần từ dữ liệu hiện có.
  const [fullName, setFullName] = useState(user.fullName)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [error, setError] = useState<string | null>(null)

  // PATCH /users/me không phải patch từng phần: fullName bắt buộc, phone thiếu sẽ bị ghi null => luôn gửi đủ hai field.
  const mutation = useMutation({
    mutationFn: () => updateMe({ fullName: fullName.trim(), phone: phone.trim() || undefined }),
    onSuccess: (updated) => {
      onSaved(updated)
      setError(null)
      toast.success('Đã cập nhật thông tin liên hệ.')
    },
  })

  function submit() {
    const name = fullName.trim()
    const digits = phone.replace(/\D/g, '')
    if (!name) {
      setError('Họ và tên không được để trống.')
      return
    }
    if (name.length > NAME_MAX) {
      setError(`Họ và tên tối đa ${NAME_MAX} ký tự.`)
      return
    }
    if (phone.trim() && (phone.trim().length > PHONE_MAX || digits.length < 8 || !PHONE_RE.test(phone.trim()))) {
      setError(`Số điện thoại không hợp lệ (tối đa ${PHONE_MAX} ký tự, ví dụ 0901234567).`)
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4"
    >
      <Input
        label="Họ và tên"
        autoComplete="name"
        maxLength={NAME_MAX}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        hint={error ?? 'Gia sư nhìn thấy tên này trong yêu cầu và lịch học.'}
        className={error ? 'border-red-400' : undefined}
      />
      <Input
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        maxLength={PHONE_MAX}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        hint="Gia sư chỉ thấy số sau khi hai bên xác nhận lịch học. Để trống nếu bạn không muốn chia sẻ."
      />
      <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <UserCog className="mt-0.5 size-4 shrink-0" />
        Email đăng nhập ({user.email}) không thể thay đổi tại đây.
      </p>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={mutation.isPending}>
          <Save className="size-4" /> Lưu liên hệ
        </Button>
      </div>
    </form>
  )
}
