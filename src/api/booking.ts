import { http } from './client'
import type { Booking, BookingInput, RecurringBookingInput, RecurringResult } from './types'

export type { RecurringResult } from './types'

export async function createBooking(payload: BookingInput): Promise<Booking> {
  const { data } = await http.post<Booking>('/bookings', payload)
  return data
}

/** 201 kể cả khi toàn bộ buổi đều thất bại; kết quả từng buổi nằm trong `failed`. */
export async function createRecurringBookings(payload: RecurringBookingInput): Promise<RecurringResult> {
  const { data } = await http.post<RecurringResult>('/bookings/recurring', payload)
  return data
}

/** Backend bỏ qua mọi query param và trả mảng thô, sắp xếp start_at DESC. */
export async function fetchMyBookings(): Promise<Booking[]> {
  const { data } = await http.get<Booking[]>('/bookings/mine')
  return data
}

export async function fetchBooking(id: number): Promise<Booking> {
  const { data } = await http.get<Booking>(`/bookings/${id}`)
  return data
}

export type BookingAction = 'confirm' | 'cancel' | 'complete' | 'no-show'

async function act(id: number, action: BookingAction, reason?: string): Promise<Booking> {
  const { data } = await http.post<Booking>(`/bookings/${id}/${action}`, reason ? { reason } : {})
  return data
}

export const confirmBooking = (id: number) => act(id, 'confirm')
export const cancelBooking = (id: number, reason?: string) => act(id, 'cancel', reason)
export const completeBooking = (id: number) => act(id, 'complete')
export const markNoShow = (id: number) => act(id, 'no-show')

/** 204, không trả review. Chỉ phụ huynh của booking COMPLETED, tối đa 1 lần/booking. */
export async function createReview(bookingId: number, rating: number, comment?: string): Promise<void> {
  await http.post(`/bookings/${bookingId}/review`, { rating, comment })
}

/** 204, body { reply }. */
export async function replyToReview(reviewId: number, reply: string): Promise<void> {
  await http.post(`/reviews/${reviewId}/reply`, { reply })
}

export async function createReport(payload: {
  targetType: 'USER' | 'REVIEW' | 'BOOKING' | 'MESSAGE'
  targetId: number
  reason: string
  description?: string
}): Promise<void> {
  await http.post('/reports', payload)
}
