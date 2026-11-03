import { http } from './client'
import type { District, Subject } from './types'

/** Mảng thô, không phân trang. */
export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await http.get<Subject[]>('/subjects')
  return data
}

export async function fetchDistricts(city?: string): Promise<District[]> {
  const { data } = await http.get<District[]>('/districts', { params: { city } })
  return data
}
