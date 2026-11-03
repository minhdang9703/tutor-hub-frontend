import { http } from './client'
import type { Child, ChildInput, ParentProfile, ParentProfileInput } from './types'

export async function fetchMyParentProfile(): Promise<ParentProfile> {
  const { data } = await http.get<ParentProfile>('/parents/me')
  return data
}

export async function updateMyParentProfile(payload: ParentProfileInput): Promise<ParentProfile> {
  const { data } = await http.put<ParentProfile>('/parents/me', payload)
  return data
}

export async function fetchChildren(): Promise<Child[]> {
  const { data } = await http.get<Child[]>('/parents/me/children')
  return data
}

export async function createChild(payload: ChildInput): Promise<Child> {
  const { data } = await http.post<Child>('/parents/me/children', payload)
  return data
}

export async function updateChild(id: number, payload: ChildInput): Promise<Child> {
  const { data } = await http.put<Child>(`/parents/me/children/${id}`, payload)
  return data
}

export async function deleteChild(id: number): Promise<void> {
  await http.delete(`/parents/me/children/${id}`)
}
