import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Star } from 'lucide-react'
import { createReview } from '../../api/booking'
import { ApiClientError } from '../../api/client'
import type { Booking } from '../../api/types'
import { formatDateTime } from '../../lib/format'
import { showApiError } from '../../lib/useMutationErrorToast'
import { Button, Textarea } from '../../components/ui'
import { invalidateBooking, useSubjectNames } from './bookingLogic'

const COMMENT_MAX = 1000

const RATING_LABEL: Record<number, string> = {
  1: 'Rất không hài lòng',
  2: 'Không hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất hài lòng',
}

interface Props {
  booking: Booking
  onClose: () => void
}

export default function ReviewDialog({ booking, onClose }: Props) {
  const queryClient = useQueryClient()
  const subjectNames = useSubjectNames()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const mutation = useMutation({
    mutationFn: () => createReview(booking.id, rating, comment.trim() || undefined),
    onSuccess: () => {
      invalidateBooking(queryClient, booking.id)
      queryClient.invalidateQueries({ queryKey: ['tutor', booking.tutorId] })
      toast.success('Cảm ơn bạn đã đánh giá buổi học.')
      onClose()
    },
    onError: (error) => {
      if (error instanceof ApiClientError && (error.code === 'REVIEW_ALREADY_EXISTS' || error.status === 409)) {
        toast.error('Buổi học này đã được đánh giá.')
        invalidateBooking(queryClient, booking.id)
        onClose()
        return
      }
      showApiError(error)
    },
  })

  const subjectName = subjectNames.get(booking.subjectId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <form
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (comment.length > COMMENT_MAX) return
          mutation.mutate()
        }}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">Đánh giá buổi học</h2>
        <p className="mt-1 text-sm text-slate-500">
          {subjectName ? `${subjectName} · ` : ''}
          {formatDateTime(booking.startAt)}
        </p>

        <div className="mt-5">
          <span className="text-sm font-medium text-slate-700">Chấm sao</span>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} sao`}
                aria-pressed={rating === value}
                className="rounded p-1 text-amber-500 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                <Star className="size-7" fill={value <= rating ? 'currentColor' : 'none'} strokeWidth={value <= rating ? 0 : 1.5} />
              </button>
            ))}
            <span className="ml-2 text-sm font-medium text-slate-600">{RATING_LABEL[rating]}</span>
          </div>
        </div>

        <Textarea
          className="mt-4"
          label="Nhận xét (không bắt buộc)"
          placeholder="Phương pháp dạy, thái độ, tiến bộ của con…"
          value={comment}
          maxLength={COMMENT_MAX}
          rows={4}
          onChange={(e) => setComment(e.target.value)}
          hint={`${comment.length}/${COMMENT_MAX} ký tự`}
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Để sau
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Gửi đánh giá
          </Button>
        </div>
      </form>
    </div>
  )
}
