import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, MapPin, Search, Star } from 'lucide-react'
import { searchTutors } from '../../api/tutor'
import { fetchDistricts } from '../../api/catalog'
import type { TutorCard } from '../../api/types'
import { MODE_LABEL } from '../../lib/labels'
import { formatVnd } from '../../lib/format'
import { Button, Input, Spinner } from '../../components/ui'

const MIN_QUERY = 2

interface Props {
  selected: TutorCard | null
  onPick: (tutor: TutorCard) => void
  onClear: () => void
}

export default function TutorSearchSelect({ selected, onPick, onClear }: Props) {
  const [q, setQ] = useState('')
  const trimmed = q.trim()

  const searchQuery = useQuery({
    queryKey: ['tutor-search', trimmed],
    queryFn: () => searchTutors({ q: trimmed, page: 0, size: 5, sort: 'rating' }),
    enabled: trimmed.length >= MIN_QUERY,
  })

  const districtsQuery = useQuery({ queryKey: ['catalog', 'districts'], queryFn: () => fetchDistricts() })
  const districtNames = useMemo(
    () => new Map((districtsQuery.data ?? []).map((d) => [d.id, d.name])),
    [districtsQuery.data],
  )

  if (selected) {
    const district = selected.districtId != null ? districtNames.get(selected.districtId) : undefined
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{selected.fullName}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {formatVnd(selected.hourlyRate)}/giờ · {MODE_LABEL[selected.teachingMode]}
            </p>
            <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 text-amber-500" /> {selected.ratingAvg.toFixed(1)} ({selected.ratingCount} đánh giá)
              </span>
              {district && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {district}
                </span>
              )}
            </p>
          </div>
          <Button type="button" variant="secondary" className="shrink-0 px-3 py-1.5" onClick={onClear}>
            Đổi gia sư
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Input
        label="Gia sư"
        placeholder="Nhập tên, môn dạy hoặc trường (tối thiểu 2 ký tự)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        hint="Chỉ hiện gia sư đã được TutorHub xác minh."
      />

      {trimmed.length >= MIN_QUERY && searchQuery.isLoading && <Spinner />}

      {trimmed.length >= MIN_QUERY && searchQuery.isError && (
        <p className="text-sm text-red-600">Không tìm được gia sư (backend chưa chạy?).</p>
      )}

      {searchQuery.data && searchQuery.data.content.length === 0 && (
        <p className="text-sm text-slate-500">Không có gia sư nào khớp “{trimmed}”.</p>
      )}

      {searchQuery.data && searchQuery.data.content.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {searchQuery.data.content.map((tutor) => (
            <li key={tutor.id}>
              <button
                type="button"
                onClick={() => onPick(tutor)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Search className="size-3.5 text-slate-300" /> {tutor.fullName}
                  </span>
                  <span className="mt-0.5 block truncate text-slate-500">
                    {tutor.headline ?? 'Gia sư'} · {formatVnd(tutor.hourlyRate)}/giờ
                  </span>
                </span>
                <Check className="size-4 shrink-0 text-brand-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
