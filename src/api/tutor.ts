import { http } from './client'
import type {
  AvailabilitySlot,
  DocumentType,
  Page,
  TutorCard,
  TutorDocument,
  TutorProfileInput,
  TutorProfileMine,
  TutorPublic,
  TutorReview,
  TutorSearchFilters,
  TutorSubject,
  TutorSubjectInput,
} from './types'

export async function searchTutors(filters: TutorSearchFilters): Promise<Page<TutorCard>> {
  const { data } = await http.get<Page<TutorCard>>('/tutors', { params: filters })
  return data
}

export async function fetchTutor(id: number): Promise<TutorPublic> {
  const { data } = await http.get<TutorPublic>(`/tutors/${id}`)
  return data
}

export async function fetchTutorReviews(id: number, page = 0, size = 20): Promise<Page<TutorReview>> {
  const { data } = await http.get<Page<TutorReview>>(`/tutors/${id}/reviews`, { params: { page, size } })
  return data
}

/** Khung trống của MỘT ngày cụ thể (backend yêu cầu tham số date, kiểu ISO yyyy-MM-dd). */
export async function fetchFreeSlots(id: number, date: string): Promise<AvailabilitySlot[]> {
  const { data } = await http.get<AvailabilitySlot[]>(`/tutors/${id}/availability`, { params: { date } })
  return data
}

export async function fetchMyTutorProfile(): Promise<TutorProfileMine> {
  const { data } = await http.get<TutorProfileMine>('/tutors/me')
  return data
}

export async function updateMyTutorProfile(payload: TutorProfileInput): Promise<TutorProfileMine> {
  const { data } = await http.put<TutorProfileMine>('/tutors/me', payload)
  return data
}

export async function fetchMySubjects(): Promise<TutorSubject[]> {
  const { data } = await http.get<TutorSubject[]>('/tutors/me/subjects')
  return data
}

/** PUT toàn bộ, body là mảng trần. */
export async function updateMySubjects(subjects: TutorSubjectInput[]): Promise<TutorSubject[]> {
  const { data } = await http.put<TutorSubject[]>('/tutors/me/subjects', subjects)
  return data
}

export async function fetchMyAvailability(): Promise<AvailabilitySlot[]> {
  const { data } = await http.get<AvailabilitySlot[]>('/tutors/me/availability')
  return data
}

export async function updateMyAvailability(slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]> {
  const { data } = await http.put<AvailabilitySlot[]>('/tutors/me/availability', slots)
  return data
}

/** docType là query param `type`, file là part `file`; PDF/JPEG/PNG, tối đa 5 MB. */
export async function uploadDocument(file: File, type: DocumentType): Promise<TutorDocument> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<TutorDocument>('/tutors/me/documents', form, { params: { type } })
  return data
}

export async function fetchDocuments(): Promise<TutorDocument[]> {
  const { data } = await http.get<TutorDocument[]>('/tutors/me/documents')
  return data
}

export async function deleteDocument(docId: number): Promise<void> {
  await http.delete(`/tutors/me/documents/${docId}`)
}

/** 204. Lỗi 422 PROFILE_INCOMPLETE khi thiếu headline/educationLevel/school/hourlyRate>0/môn/CCCD. */
export async function submitForReview(): Promise<void> {
  await http.post('/tutors/me/submit')
}
