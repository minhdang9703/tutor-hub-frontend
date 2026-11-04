import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ApiClientError } from '../api/client'

/** Backend trả message tiếng Anh; người dùng chỉ thấy bản tiếng Việt khi mã lỗi đã biết. */
const MESSAGE_VI: Record<string, string> = {
  REVIEW_EXISTS: 'Buổi học này đã được đánh giá.',
  TUTOR_UNAVAILABLE: 'Gia sư không trống trong khung giờ này.',
  CANCELLATION_WINDOW_CLOSED: 'Đã quá thời hạn cho phép để hủy buổi học.',
  BOOKING_NOT_STARTED: 'Buổi học chưa bắt đầu nên chưa thể đánh dấu hoàn thành.',
}

export function showApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    const detail = typeof error.details?.['message'] === 'string' ? `: ${error.details['message']}` : ''
    toast.error(`${MESSAGE_VI[error.code] ?? error.message}${detail}`)
    return
  }
  if (error instanceof Error) toast.error(error.message)
}

export function useMutationErrorToast() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event?.type === 'updated') {
        const mutation = event.mutation
        const state = mutation.state
        if (state.status === 'error' && !state.isPaused && !errorShown.has(mutation)) {
          errorShown.add(mutation)
          showApiError(state.error)
        }
      }
      if (event?.type === 'removed') errorShown.delete(event.mutation)
    })
    return unsubscribe
  }, [queryClient])
}

const errorShown = new WeakSet<object>()
