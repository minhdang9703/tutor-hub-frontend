import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { createChild, deleteChild, fetchChildren, updateChild } from '../../api/parent'
import type { Child, ChildInput } from '../../api/types'
import { Button, EmptyState, Input, Select, Spinner, Textarea } from '../../components/ui'

const CHILDREN_KEY = ['parent', 'children'] as const

// Mirror ChildRequest: name @NotBlank @Size(max=80), grade @Min(1) @Max(12), school max 160, notes max 500.
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)
const NAME_MAX = 80
const SCHOOL_MAX = 160
const NOTES_MAX = 500
const BLANK: ChildInput = { name: '', grade: 6, school: '', notes: '' }

export default function ChildrenPanel() {
  const queryClient = useQueryClient()
  const childrenQuery = useQuery({ queryKey: CHILDREN_KEY, queryFn: fetchChildren })
  const [draft, setDraft] = useState<ChildInput | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  function closeForm() {
    setDraft(null)
    setEditingId(null)
  }

  function openForm(child: Child) {
    setEditingId(child.id)
    setDraft({ name: child.name, grade: child.grade, school: child.school ?? '', notes: child.notes ?? '' })
  }

  const saveMutation = useMutation({
    // Tạo mới trả 201 kèm object con; cập nhật trả 200 — cả hai chỉ cần refresh danh sách.
    mutationFn: (input: ChildInput) => (editingId ? updateChild(editingId, input) : createChild(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHILDREN_KEY })
      toast.success(editingId ? 'Đã cập nhật thông tin con.' : 'Đã thêm con vào hồ sơ.')
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    // 204. Con của phụ huynh khác: server trả 404/403 và toast toàn cục sẽ nêu lỗi.
    mutationFn: (id: number) => deleteChild(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHILDREN_KEY })
      toast.success('Đã xóa con khỏi hồ sơ.')
      setConfirmId(null)
    },
  })

  const children = childrenQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {childrenQuery.isLoading ? 'Đang tải…' : `${children.length} con trong hồ sơ`}
        </p>
        {!draft && (
          <Button
            variant="secondary"
            className="px-3 py-1.5"
            onClick={() => {
              setDraft(BLANK)
              setEditingId(null)
            }}
          >
            <Plus className="size-4" /> Thêm con
          </Button>
        )}
      </div>

      {childrenQuery.isError && (
        <EmptyState>Không tải được danh sách con. Kiểm tra backend TutorHub đang chạy rồi thử lại.</EmptyState>
      )}

      {draft && (
        <ChildForm
          child={draft}
          editing={editingId != null}
          submitting={saveMutation.isPending}
          onChange={setDraft}
          onCancel={closeForm}
          onSubmit={(input) => saveMutation.mutate(input)}
        />
      )}

      {!draft && childrenQuery.isLoading && <Spinner />}

      {!draft && !childrenQuery.isLoading && children.length === 0 && (
        <EmptyState>Chưa có thông tin con. Thêm con để chọn người học khi đặt lịch với gia sư.</EmptyState>
      )}

      {!draft && children.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {children.map((child) => (
            <li key={child.id} className="bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {child.name} <span className="ml-1 text-sm text-slate-500">· Lớp {child.grade}</span>
                  </p>
                  {child.school && <p className="mt-0.5 text-sm text-slate-500">{child.school}</p>}
                  {child.notes && <p className="mt-1 text-sm text-slate-500">{child.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => openForm(child)}>
                    <Pencil className="size-4" /> Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                    onClick={() => setConfirmId(child.id)}
                  >
                    <Trash2 className="size-4" /> Xóa
                  </Button>
                </div>
              </div>

              {confirmId === child.id && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
                  <p className="text-sm text-red-700">
                    Xóa “{child.name}”? Các buổi học đã đặt vẫn còn nhưng sẽ mất liên kết tới con.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="px-3 py-1.5" onClick={() => setConfirmId(null)}>
                      Không
                    </Button>
                    <Button
                      variant="danger"
                      className="px-3 py-1.5"
                      loading={deleteMutation.isPending && deleteMutation.variables === child.id}
                      onClick={() => deleteMutation.mutate(child.id)}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface FormProps {
  child: ChildInput
  editing: boolean
  submitting: boolean
  onChange: (next: ChildInput) => void
  onCancel: () => void
  onSubmit: (input: ChildInput) => void
}

function ChildForm({ child, editing, submitting, onChange, onCancel, onSubmit }: FormProps) {
  const name = child.name.trim()
  const problem = !name
    ? 'Không để trống tên con.'
    : name.length > NAME_MAX
      ? `Tên con tối đa ${NAME_MAX} ký tự.`
      : child.grade < 1 || child.grade > 12
        ? 'Lớp phải từ 1 đến 12.'
        : null

  function submit() {
    if (problem) return
    onSubmit({
      name,
      grade: child.grade,
      school: child.school?.trim() || undefined,
      notes: child.notes?.trim() || undefined,
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <p className="text-sm font-semibold text-slate-700">{editing ? 'Sửa thông tin con' : 'Thêm con'}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Tên con"
          required
          value={child.name}
          maxLength={NAME_MAX}
          onChange={(e) => onChange({ ...child, name: e.target.value })}
          hint={problem ?? undefined}
          className={problem ? 'border-red-400' : undefined}
        />
        <Select
          label="Lớp"
          value={child.grade}
          onChange={(e) => onChange({ ...child, grade: Number(e.target.value) })}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              Lớp {g}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Trường (không bắt buộc)"
        placeholder="VD: Tiểu học Kim Đồng"
        value={child.school ?? ''}
        maxLength={SCHOOL_MAX}
        onChange={(e) => onChange({ ...child, school: e.target.value })}
      />

      <Textarea
        label="Ghi chú cho gia sư (không bắt buộc)"
        placeholder="Sức khỏe, mục tiêu học, chỗ ngồi thuận tiện…"
        value={child.notes ?? ''}
        maxLength={NOTES_MAX}
        rows={3}
        onChange={(e) => onChange({ ...child, notes: e.target.value })}
        hint={`${(child.notes ?? '').length}/${NOTES_MAX} ký tự`}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" loading={submitting} disabled={problem !== null}>
          {editing ? 'Lưu thay đổi' : 'Thêm con'}
        </Button>
      </div>
    </form>
  )
}
