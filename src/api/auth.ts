import { http } from './client'
import { clearTokens, getTokens, setTokens } from './tokenStore'
import type { AuthTokenResponse, LoginRequest, RegisterRequest, RegisterResult, User } from './types'

/** Backend trả token nhưng không trả user, nên phải gọi thêm /users/me. */
export async function login(payload: LoginRequest): Promise<AuthTokenResponse> {
  const { data } = await http.post<AuthTokenResponse>('/auth/login', payload)
  setTokens(data)
  return data
}

export async function loginAsUser(payload: LoginRequest): Promise<User> {
  await login(payload)
  return fetchMe()
}

/** 201, chỉ { userId, message } — không có token, chưa đăng nhập. */
export async function register(payload: RegisterRequest): Promise<RegisterResult> {
  const { data } = await http.post<RegisterResult>('/auth/register', payload)
  return data
}

export async function logout(): Promise<void> {
  const tokens = getTokens()
  try {
    if (tokens) await http.post('/auth/logout', { refreshToken: tokens.refreshToken })
  } finally {
    clearTokens()
  }
}

export async function verifyEmail(token: string): Promise<void> {
  await http.post('/auth/verify-email', { token })
}

/** Email lạ trả 404 với endpoint này (khác /forgot-password luôn im lặng 204). */
export async function resendVerification(email: string): Promise<void> {
  await http.post('/auth/resend-verification', { email })
}

export async function forgotPassword(email: string): Promise<void> {
  await http.post('/auth/forgot-password', { email })
}

/** Thu hồi mọi refresh token: client phải đăng nhập lại. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await http.post('/auth/reset-password', { token, newPassword })
  clearTokens()
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await http.post('/auth/change-password', { currentPassword, newPassword })
  clearTokens()
}

export async function fetchMe(): Promise<User> {
  const { data } = await http.get<User>('/users/me')
  return data
}

/** Không phải PATCH từng phần: fullName bắt buộc, phone thiếu sẽ bị ghi null. */
export async function updateMe(payload: { fullName: string; phone?: string | null }): Promise<User> {
  const { data } = await http.patch<User>('/users/me', payload)
  return data
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<User>('/users/me/avatar', form)
  return data
}

export async function deleteAccount(): Promise<void> {
  await http.delete('/users/me')
}
