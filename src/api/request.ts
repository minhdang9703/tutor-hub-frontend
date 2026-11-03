import { http } from './client'
import type { Application, ApplicationInput, Page, TutorRequest, TutorRequestInput } from './types'

export async function createRequest(payload: TutorRequestInput): Promise<TutorRequest> {
  const { data } = await http.post<TutorRequest>('/requests', payload)
  return data
}

/** Bộ lọc duy nhất là page/size; backend tự lấy OPEN chưa hết hạn, chỉ gia sư VERIFIED gọi được. */
export async function fetchOpenRequests(page = 0, size = 20): Promise<Page<TutorRequest>> {
  const { data } = await http.get<Page<TutorRequest>>('/requests', { params: { page, size } })
  return data
}

export async function fetchMyRequests(page = 0, size = 20): Promise<Page<TutorRequest>> {
  const { data } = await http.get<Page<TutorRequest>>('/requests/mine', { params: { page, size } })
  return data
}

export async function fetchRequest(id: number): Promise<TutorRequest> {
  const { data } = await http.get<TutorRequest>(`/requests/${id}`)
  return data
}

/** Backend dùng PATCH theo hướng thay thế toàn bộ bản ghi, không sửa từng trường. */
export async function updateRequest(id: number, payload: TutorRequestInput): Promise<TutorRequest> {
  const { data } = await http.patch<TutorRequest>(`/requests/${id}`, payload)
  return data
}

export async function closeRequest(id: number): Promise<void> {
  await http.post(`/requests/${id}/close`)
}

export async function applyToRequest(requestId: number, payload: ApplicationInput): Promise<Application> {
  const { data } = await http.post<Application>(`/requests/${requestId}/applications`, payload)
  return data
}

/** Mảng thô, chỉ phụ huynh sở hữu yêu cầu. */
export async function fetchRequestApplications(requestId: number): Promise<Application[]> {
  const { data } = await http.get<Application[]>(`/requests/${requestId}/applications`)
  return data
}

export async function fetchMyApplications(page = 0, size = 20): Promise<Page<Application>> {
  const { data } = await http.get<Page<Application>>('/applications/mine', { params: { page, size } })
  return data
}

export async function acceptApplication(id: number): Promise<void> {
  await http.post(`/applications/${id}/accept`)
}

export async function rejectApplication(id: number): Promise<void> {
  await http.post(`/applications/${id}/reject`)
}

export async function withdrawApplication(id: number): Promise<void> {
  await http.post(`/applications/${id}/withdraw`)
}
