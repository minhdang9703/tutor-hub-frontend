import type { AuthTokenResponse } from './types'

const KEY_ACCESS = 'tutorhub.accessToken'
const KEY_REFRESH = 'tutorhub.refreshToken'

export type AuthTokens = Pick<AuthTokenResponse, 'accessToken' | 'refreshToken'>

export function getTokens(): AuthTokens | null {
  const accessToken = localStorage.getItem(KEY_ACCESS)
  const refreshToken = localStorage.getItem(KEY_REFRESH)
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken }
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(KEY_ACCESS, tokens.accessToken)
  localStorage.setItem(KEY_REFRESH, tokens.refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(KEY_ACCESS)
  localStorage.removeItem(KEY_REFRESH)
}
