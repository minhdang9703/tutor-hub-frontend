import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'
import { fetchDistricts } from '../../../api/catalog'
import { fetchMyTutorProfile, updateMyTutorProfile } from '../../../api/tutor'
import type { TeachingMode, TutorProfileInput, TutorProfileMine } from '../../../api/types'
import { EDUCATION_LABEL, MODE_LABEL, VERIFICATION_STATUS_LABEL } from '../../../lib/labels'
import { formatVnd } from '../../../lib/format'
import { Badge, Button, Card, Input, Select, Spinner, Textarea } from '../../../components/ui'

/** educationLevel chỉ nhận 5 giá trị này (CHECK ở cột education_level của backend). */
const EDUCATION_VALUES = Object.keys(EDUCATION_LABEL)
const MODE_VALUES = Object.keys(MODE_LABEL) as TeachingMode[]

const MAX_HEADLINE = 160
const MAX_SCHOOL = 160
const MAX_MAJOR = 120
const MAX_YEARS = 60

interface FormState {
  headline: string
  bio: string
  educationLevel: string
  school: string
  major: string
  yearsExperience: string
  hourlyRate: string
  teachingMode: TeachingMode
  districtId: string
}

function toForm(p: TutorProfileMine): FormState {
  return {
    headline: p.headline ?? '',
    bio: p.bio ?? '',
    educationLevel: p.educationLevel ?? '',
    school: p.school ?? '',
    major: p.major ?? '',
    yearsExperience: String(p.yearsExperience ?? 0),
    hourlyRate: String(p.hourlyRate ?? 0),
    teachingMode: p.teachingMode ?? 'BOTH',
    districtId: p.districtId != null ? String(p.districtId) : '',
  }
}

/** số nguyên không âm (backend là BIGINT / SMALLINT, payload sai sẽ trả 400 trần không có chi tiết) */
function parseInteger(value: string): number | null {
  if (value.trim() === '') return null
  if (!/^\d+$/.test(value.trim())) return null
  return Number(value.trim())
}

/** Lỗi định dạng — chặn việc gửi PUT vì backend trả 400 trần không kèm chi tiết từng trường. */
function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {}

  if (form.headline.length > MAX_HEADLINE) errors.headline = `Tiêu đề tối đa ${MAX_HEADLINE} ký tự.`
  if (form.school.length > MAX_SCHOOL) errors.school = `Tên trường tối đa ${MAX_SCHOOL} ký tự.`
  if (form.major.length > MAX_MAJOR) errors.major = `Chuyên ngành tối đa ${MAX_MAJOR} ký tự.`

  const years = parseInteger(form.yearsExperience)
  if (years === null) errors.yearsExperience = 'Số năm kinh nghiệm phải là số nguyên không âm.'
  else if (years > MAX_YEARS) errors.yearsExperience = `Số năm kinh nghiệm không được vượt quá ${MAX_YEARS}.`

  const rate = parseInteger(form.hourlyRate)
  if (rate === null) errors.hourlyRate = 'Học phí phải là số nguyên VNĐ không âm (ví dụ 150000).'
  else if (rate > 0 && rate < 1000) errors.hourlyRate = 'Học phí có vẻ sai — hãy nhập số VNĐ mỗi giờ, ví dụ 150000.'

  return errors
}

/** Trường bắt buộc khi NỘP hồ sơ duyệt (backend chặn bằng PROFILE_INCOMPLETE), không chặn việc lưu nháp. */
function missingForSubmit(form: FormState): string[] {
  const missing: string[] = []
  if (!form.headline.trim()) missing.push('tiêu đề hồ sơ')
  if (!form.educationLevel) missing.push('trình độ học vấn')
  if (!form.school.trim()) missing.push('trường / nơi công tác')
  if ((parseInteger(form.hourlyRate) ?? 0) <= 0) missing.push('học phí mỗi giờ lớn hơn 0')
  return missing
}

export default function ProfileTab() {
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['tutor', 'me'], queryFn: fetchMyTutorProfile })
  const districtsQuery = useQuery({ queryKey: ['catalog', 'districts'], queryFn: () => fetchDistricts() })

  const profile = profileQuery.data
  const locked = profile?.verificationStatus === 'PENDING'
  const [form, setForm] = useState<FormState | null>(profile ? toForm(profile) : null)

  useEffect(() => {
    if (profile) setForm(toForm(profile))
  }, [profile])

  const errors = useMemo(() => (form ? validate(form) : {}), [form])
  const errorList = Object.values(errors)
  const submitGaps = useMemo(() => (form ? missingForSubmit(form) : []), [form])

  const mutation = useMutation({
    mutationFn: () => {
      const payload: TutorProfileInput = {
        headline: form!.headline.trim() || undefined,
        bio: form!.bio.trim() || undefined,
        educationLevel: form!.educationLevel || undefined,
        school: form!.school.trim() || undefined,
        major: form!.major.trim() || undefined,
        yearsExperience: parseInteger(form!.yearsExperience) ?? 0,
        hourlyRate: parseInteger(form!.hourlyRate) ?? 0,
        teachingMode: form!.teachingMode,
        districtId: form!.districtId ? Number(form!.districtId) : null,
      }
      return updateMyTutorProfile(payload)
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['tutor', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['tutor', saved.userId] })
      queryClient.invalidateQueries({ queryKey: ['tutors', 'search'] })
      toast.success('Đã lưu hồ sơ.')
    },
  })

  if (profileQuery.isLoading) return <Spinner />
  if (!profile || !form) return null

  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const districts = districtsQuery.data ?? []
  const cities = [...new Set(districts.map((d) => d.city))]
  const needsSubmit = profile.verificationStatus === 'DRAFT' || profile.verificationStatus === 'REJECTED'

  return (
    <Card
      title="Hồ sơ cá nhân"
      actions={<Badge tone="slate">{VERIFICATION_STATUS_LABEL[profile.verificationStatus]}</Badge>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (errorList.length > 0) return
          mutation.mutate()
        }}
        className="space-y-4"
      >
        {locked && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Hồ sơ đang chờ admin duyệt nên tạm thời bị khóa. Bạn có thể chỉnh sửa sau khi có kết quả.
          </p>
        )}

        <Input
          label="Tiêu đề hồ sơ"
          maxLength={MAX_HEADLINE}
          placeholder="VD: Gia sư Toán tận tâm, 5 năm kinh nghiệm luyện thi vào 10"
          value={form.headline}
          disabled={locked}
          hint={`${form.headline.length}/${MAX_HEADLINE} ký tự. Đây là dòng phụ huynh thấy đầu tiên.`}
          onChange={(e) => set({ headline: e.target.value })}
        />

        <Textarea
          label="Giới thiệu bản thân"
          placeholder="Chia sẻ phương pháp dạy, kinh nghiệm và thành tích nổi bật..."
          value={form.bio}
          disabled={locked}
          hint="Văn bản này cùng tiêu đề, trường, chuyên ngành được dùng cho tìm kiếm toàn văn."
          onChange={(e) => set({ bio: e.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Trình độ học vấn"
            value={form.educationLevel}
            disabled={locked}
            onChange={(e) => set({ educationLevel: e.target.value })}
          >
            <option value="">— Chưa chọn —</option>
            {EDUCATION_VALUES.map((level) => (
              <option key={level} value={level}>{EDUCATION_LABEL[level]}</option>
            ))}
          </Select>

          <Select
            label="Hình thức dạy"
            value={form.teachingMode}
            disabled={locked}
            onChange={(e) => set({ teachingMode: e.target.value as TeachingMode })}
          >
            {MODE_VALUES.map((mode) => (
              <option key={mode} value={mode}>{MODE_LABEL[mode]}</option>
            ))}
          </Select>

          <Input
            label="Trường / nơi công tác"
            maxLength={MAX_SCHOOL}
            value={form.school}
            disabled={locked}
            onChange={(e) => set({ school: e.target.value })}
          />
          <Input
            label="Chuyên ngành"
            maxLength={MAX_MAJOR}
            value={form.major}
            disabled={locked}
            onChange={(e) => set({ major: e.target.value })}
          />

          <Input
            label="Số năm kinh nghiệm"
            type="number"
            min={0}
            max={MAX_YEARS}
            step={1}
            value={form.yearsExperience}
            disabled={locked}
            onChange={(e) => set({ yearsExperience: e.target.value })}
          />
          <Input
            label="Học phí mỗi giờ (VNĐ)"
            type="number"
            min={0}
            step={1000}
            value={form.hourlyRate}
            disabled={locked}
            hint={`≈ ${formatVnd(parseInteger(form.hourlyRate) ?? 0)} / giờ. Phải lớn hơn 0 để nộp hồ sơ.`}
            onChange={(e) => set({ hourlyRate: e.target.value })}
          />
        </div>

        <Select
          label="Khu vực dạy (quận / huyện)"
          value={form.districtId}
          disabled={locked}
          hint="Bỏ trống nếu bạn chỉ dạy online."
          onChange={(e) => set({ districtId: e.target.value })}
        >
          <option value="">— Toàn quốc / Chưa chọn —</option>
          {cities.map((city) => (
            <optgroup key={city} label={city}>
              {districts
                .filter((d) => d.city === city)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </optgroup>
          ))}
        </Select>

        {needsSubmit && submitGaps.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Còn thiếu {submitGaps.join(', ')} — hồ sơ sẽ bị từ chối nếu nộp ngay bây giờ.
          </p>
        )}

        {errorList.length > 0 && (
          <ul className="list-disc space-y-1 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorList.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {needsSubmit ? (
            <p className="text-sm text-slate-500">
              Lưu xong hãy sang{' '}
              <Link to="/tutor/documents" className="font-medium text-brand-600 hover:underline">tab Giấy tờ</Link>{' '}
              để nộp hồ sơ duyệt.
            </p>
          ) : (
            <span />
          )}
          <Button type="submit" loading={mutation.isPending} disabled={locked || errorList.length > 0}>
            <Save className="size-4" /> Lưu hồ sơ
          </Button>
        </div>
      </form>
    </Card>
  )
}
