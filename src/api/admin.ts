import { http } from './client'
import type {
  AdminReport,
  AdminStats,
  AdminUser,
  AuditLog,
  DocumentReviewInput,
  Page,
  TutorProfileMine,
} from './types'

export async function fetchPendingTutors(page = 0, size = 20): Promise<Page<TutorProfileMine>> {
  const { data } = await http.get<Page<TutorProfileMine>>('/admin/tutors', { params: { page, size } })
  return data
}

export async function fetchTutorForReview(id: number): Promise<TutorProfileMine> {
  const { data } = await http.get<TutorProfileMine>(`/admin/tutors/${id}`)
  return data
}

export async function verifyTutor(id: number): Promise<void> {
  await http.post(`/admin/tutors/${id}/verify`)
}

export async function rejectTutor(id: number, reason: string): Promise<void> {
  await http.post(`/admin/tutors/${id}/reject`, { reason })
}

export async function reviewDocument(docId: number, payload: DocumentReviewInput): Promise<void> {
  await http.post(`/admin/documents/${docId}/review`, payload)
}

export async function fetchUsers(page = 0, size = 20): Promise<Page<AdminUser>> {
  const { data } = await http.get<Page<AdminUser>>('/admin/users', { params: { page, size } })
  return data
}

export async function suspendUser(id: number): Promise<void> {
  await http.post(`/admin/users/${id}/suspend`)
}

export async function activateUser(id: number): Promise<void> {
  await http.post(`/admin/users/${id}/activate`)
}

export async function fetchReports(page = 0, size = 20): Promise<Page<AdminReport>> {
  const { data } = await http.get<Page<AdminReport>>('/admin/reports', { params: { page, size } })
  return data
}

export async function resolveReport(id: number, resolution: string): Promise<void> {
  await http.post(`/admin/reports/${id}/resolve`, { resolution })
}

export async function hideReview(reviewId: number): Promise<void> {
  await http.post(`/admin/reviews/${reviewId}/hide`)
}

export async function fetchAuditLogs(page = 0, size = 20): Promise<Page<AuditLog>> {
  const { data } = await http.get<Page<AuditLog>>('/admin/audit-logs', { params: { page, size } })
  return data
}

export async function fetchStats(): Promise<AdminStats> {
  const { data } = await http.get<AdminStats>('/admin/stats')
  return data
}
