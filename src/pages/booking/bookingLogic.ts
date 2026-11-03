import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { completeBooking, confirmBooking, markNoShow } from '../../api/booking'
import { fetchSubjects } from '../../api/catalog'
import { fetchChildren } from '../../api/parent'
import { ApiClientError } from '../../api/client'
import type { Booking, Role } from '../../api/types'

export type BookingAction = 'CONFIRM' | 'COMPLETE' | 'NO_SHOW'

export const ACTION_LABEL: Record<BookingAction, string> = {
  CONFIRM: 'Xác nhận',
  COMPLETE: 'Hoàn thành',
  NO_SHOW: 'Vắng mặt',
}

const ACTION_API: Record<BookingAction, (id: number) => Promise<Booking>> = {
  CONFIRM: confirmBooking,
  COMPLETE: completeBooking,
  NO_SHOW: markNoShow,
}

const ACTION_DONE_TEXT: Record<BookingAction, string> = {
  CONFIRM: 'Đã xác nhận buổi học.',
  COMPLETE: 'Đã đánh dấu buổi học hoàn thành.',
  NO_SHOW: 'Đã ghi nhận buổi vắng mặt.',
}

// Quy tắc hủy nằm ở server (cấu hình được) nên UI chỉ cảnh báo, không chặn.
export const CANCEL_MIN_HOURS = 6

export function availableActions(booking: Booking, role: Role): BookingAction[] {
  if (role === 'TUTOR' && booking.status === 'PENDING') return ['CONFIRM']
  if (role === 'TUTOR' && booking.status === 'CONFIRMED') return ['COMPLETE', 'NO_SHOW']
  return []
}

export function canCancel(booking: Booking, role: Role): boolean {
  const open = booking.status === 'PENDING' || booking.status === 'CONFIRMED'
  return open && (role === 'PARENT' || role === 'TUTOR')
}

// Backend không nhúng review vào booking và không có "reviewId", nên UI cho phép mở form;
// gửi lần hai sẽ bị 409 và thông báo lỗi hiển thị cho người dùng.
export function canReview(booking: Booking, role: Role): boolean {
  return role === 'PARENT' && booking.status === 'COMPLETED'
}

export function hoursUntilStart(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000
}

/** Backend không cho tra tên đối tác theo id; chỉ tiết lộ SĐT sau khi xác nhận. */
export function otherPartyPhone(booking: Booking, role: Role): string | null {
  return (role === 'TUTOR' ? booking.parentPhone : booking.tutorPhone) ?? null
}

export function phoneHiddenHint(role: Role): string {
  return role === 'TUTOR' ? 'Sẽ hiển thị sau khi bạn xác nhận buổi học' : 'Sẽ hiển thị sau khi gia sư xác nhận'
}

const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })

export function timeRange(range: Pick<Booking, 'startAt' | 'endAt'>): string {
  return `${clock.format(new Date(range.startAt))} – ${clock.format(new Date(range.endAt))}`
}

export function invalidateBooking(queryClient: QueryClient, bookingId?: number) {
  queryClient.invalidateQueries({ queryKey: ['bookings'] })
  if (bookingId != null) queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
}

/** Môn học: id → tên, dùng cache chung với trang danh mục. */
export function useSubjectNames(): Map<number, string> {
  const { data } = useQuery({ queryKey: ['catalog', 'subjects'], queryFn: fetchSubjects })
  return useMemo(() => new Map((data ?? []).map((s) => [s.id, s.name])), [data])
}

/** Con của phụ huynh: id → tên. Trang gia sư không gọi endpoint này. */
export function useChildNames(enabled: boolean): Map<number, string> {
  const { data } = useQuery({ queryKey: ['parent', 'children'], queryFn: fetchChildren, enabled })
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c.name])), [data])
}

export function useBookingActions() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ action, id }: { action: BookingAction; id: number }) => ACTION_API[action](id),
    onSuccess: (booking, { action }) => {
      invalidateBooking(queryClient, booking.id)
      toast.success(ACTION_DONE_TEXT[action])
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.code === 'BOOKING_OVERLAP') {
        toast.error('Khung giờ vừa bị người khác đặt')
      } else if (error instanceof ApiClientError) {
        toast.error(error.message)
      }
    },
  })

  return {
    run: (action: BookingAction, id: number) => mutation.mutate({ action, id }),
    pendingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
  }
}
