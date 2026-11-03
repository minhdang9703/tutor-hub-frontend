import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Save, Trash2 } from 'lucide-react'
import { fetchSubjects } from '../../../api/catalog'
import { fetchMySubjects, fetchMyTutorProfile, updateMySubjects } from '../../../api/tutor'
import type { Subject, TutorSubjectInput } from '../../../api/types'
import { Button, Card, EmptyState, Select, Spinner } from '../../../components/ui'

type Row = TutorSubjectInput

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

function nameOf(subjects: Map<number, Subject>, id: number): string {
  return subjects.get(id)?.name ?? `Môn #${id}`
}

/** Backend: PUT thay toàn bộ danh sách; PK (tutor_id, subject_id) và CHECK 1..12, grade_to >= grade_from. */
function validateRows(rows: Row[], subjects: Map<number, Subject>): string[] {
  const errors: string[] = []
  const counts = new Map<number, number>()
  for (const row of rows) {
    if (!subjects.has(row.subjectId)) errors.push('Có môn học không còn khả dụng, hãy chọn lại.')
    if (!Number.isInteger(row.gradeFrom) || !Number.isInteger(row.gradeTo) || row.gradeFrom < 1 || row.gradeTo > 12) {
      errors.push('Khối lớp phải là số nguyên từ 1 đến 12.')
    }
    if (row.gradeTo < row.gradeFrom) errors.push(`${nameOf(subjects, row.subjectId)}: khối kết thúc phải lớn hơn hoặc bằng khối bắt đầu.`)
    counts.set(row.subjectId, (counts.get(row.subjectId) ?? 0) + 1)
  }
  for (const [id, count] of counts) {
    if (count > 1) errors.push(`${nameOf(subjects, id)}: mỗi môn chỉ được thêm một lần.`)
  }
  return [...new Set(errors)]
}

export default function SubjectsTab() {
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['tutor', 'me'], queryFn: fetchMyTutorProfile })
  const catalogQuery = useQuery({ queryKey: ['catalog', 'subjects'], queryFn: fetchSubjects })
  const tutorSubjectsQuery = useQuery({ queryKey: ['tutor', 'me', 'subjects'], queryFn: fetchMySubjects })

  const profile = profileQuery.data
  const locked = profile?.verificationStatus === 'PENDING'
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const saved = tutorSubjectsQuery.data
    if (saved) setRows(saved.map((s) => ({ subjectId: s.subjectId, gradeFrom: s.gradeFrom, gradeTo: s.gradeTo })))
  }, [tutorSubjectsQuery.data])

  const catalog = useMemo(() => new Map((catalogQuery.data ?? []).map((s) => [s.id, s])), [catalogQuery.data])
  const errors = useMemo(() => validateRows(rows, catalog), [rows, catalog])

  const mutation = useMutation({
    mutationFn: () => updateMySubjects(rows.map((r) => ({ subjectId: r.subjectId, gradeFrom: r.gradeFrom, gradeTo: r.gradeTo }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutor', 'me', 'subjects'] })
      queryClient.invalidateQueries({ queryKey: ['tutor', 'me'] })
      if (profile) queryClient.invalidateQueries({ queryKey: ['tutor', profile.userId] })
      queryClient.invalidateQueries({ queryKey: ['tutors', 'search'] })
      toast.success('Đã cập nhật môn dạy.')
    },
  })

  function addRow() {
    const used = new Set(rows.map((r) => r.subjectId))
    const next = [...catalog.values()].find((s) => !used.has(s.id))
    if (!next) {
      toast('Đã có đủ tất cả môn học khả dụng.')
      return
    }
    setRows((rs) => [...rs, { subjectId: next.id, gradeFrom: 1, gradeTo: 12 }])
  }

  function patchRow(index: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  if (tutorSubjectsQuery.isLoading || catalogQuery.isLoading) return <Spinner />

  const usedIds = new Set(rows.map((r) => r.subjectId))

  return (
    <Card
      title="Môn dạy"
      actions={
        <Button variant="secondary" onClick={addRow} disabled={locked || catalog.size === 0}>
          <Plus className="size-4" /> Thêm môn
        </Button>
      }
    >
      {locked && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Hồ sơ đang chờ duyệt nên danh sách môn tạm bị khóa.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState>Chưa có môn dạy nào. Cần ít nhất một môn để nộp hồ sơ — bấm “Thêm môn” để bắt đầu.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.subjectId} className="flex flex-wrap items-end gap-3">
              <div className="min-w-52 flex-1">
                <Select
                  label="Môn học"
                  value={row.subjectId}
                  disabled={locked}
                  onChange={(e) => patchRow(index, { subjectId: Number(e.target.value) })}
                >
                  {[...catalog.values()].map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id !== row.subjectId && usedIds.has(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Select
                label="Từ lớp"
                className="w-28"
                value={row.gradeFrom}
                disabled={locked}
                onChange={(e) => patchRow(index, { gradeFrom: Number(e.target.value) })}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>Lớp {g}</option>
                ))}
              </Select>
              <Select
                label="Đến lớp"
                className="w-28"
                value={row.gradeTo}
                disabled={locked}
                onChange={(e) => patchRow(index, { gradeTo: Number(e.target.value) })}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>Lớp {g}</option>
                ))}
              </Select>
              <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))} disabled={locked}>
                <Trash2 className="size-4" /> Xóa
              </Button>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {rows.length === 0
            ? 'Phụ huynh lọc tìm gia sư theo môn và khối lớp của con.'
            : `${rows.length} môn · lưu đè toàn bộ danh sách khi bạn bấm Lưu.`}
        </p>
        <Button loading={mutation.isPending} disabled={locked || errors.length > 0} onClick={() => mutation.mutate()}>
          <Save className="size-4" /> Lưu môn dạy
        </Button>
      </div>
    </Card>
  )
}
