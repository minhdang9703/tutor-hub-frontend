import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { TriangleAlert } from 'lucide-react'
import { cancelBooking } from '../../api/booking'
import type { Booking } from '../../api/types'
import { formatDateTime } from '../../lib/format'
import { showApiError } from '../../lib/useMutationErrorToast'
import { Button, Textarea } from '../../components/ui'
import { CANCEL_MIN_HOURS, hoursUntilStart, invalidateBooking, timeRange, useSubjectNames } from './bookingLogic'

const REASON_MAX = 1000

interface Props {
  booking: Booking
  onClose: () => void
}

export default function CancelBookingDialog({ booking, onClose }: Props) {
  const queryClient = useQueryClient()
  const subjectNames = useSubjectNames()
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => cancelBooking(booking.id, reason.trim() || undefined),
    onSuccess: (updated) => {
      invalidateBooking(queryClient, updated.id)
      toast.success('Đã hủy buổi học.')
      onClose()
    },
    //Backend trả 409 khi ngoài thời gian cho phép — hiển thị nguyên văn thông báo của server.
    onError: (error) => showApiError(error),
  })

  const hoursLeft = Math.max(0, hoursUntilStart(booking.startAt))
  const risky = hoursLeft < CANCEL_MIN_HOURS
  const subjectName = subjectNames.get(booking.subjectId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <form
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (reason.length > REASON_MAX) return
          mutation.mutate()
        }}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">Hủy buổi học</h2>
        <p className="mt-1 text-sm text-slate-500">
          {subjectName ? `${subjectName} · ` : ''}
          {formatDateTime(booking.startAt)} · {timeRange(booking)}
        </p>

        <div className="mt-4 rounded-lg bg-amber-50 p-3.5 text-sm text-amber-800 ring-1 ring-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 shrink-0" /> Chỉ hủy được trong thời gian quy định
          </p>
          <p className="mt-1 text-amber-700">
            {risky
              ? `Buổi học còn khoảng ${hoursLeft.toFixed(1)} giờ nữa, yêu cầu hủy có thể bị hệ thống từ chối.`
              : 'Hệ thống sẽ kiểm tra thời điểm hủy khi bạn gửi yêu cầu.'}
          </p>
        </div>

        <Textarea
          className="mt-4"
          label="Lý do hủy (không bắt buộc)"
          placeholder="VD: Con bị sốt, gia sư bận đột xuất…"
          value={reason}
          maxLength={REASON_MAX}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
          hint={`${reason.length}/${REASON_MAX} ký tự`}
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button type="submit" variant="danger" loading={mutation.isPending}>
            Xác nhận hủy
          </Button>
        </div>
      </form>
    </div>
  )
}
