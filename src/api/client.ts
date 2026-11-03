import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { clearTokens, getTokens, setTokens } from './tokenStore'
import type { ApiErrorBody, AuthTokenResponse } from './types'

export class ApiClientError extends Error {
  code: string
  details?: Record<string, unknown>
  status: number

  constructor(status: number, body?: Partial<ApiErrorBody>) {
    super(body?.message ?? defaultMessage(status))
    this.code = body?.code ?? codeForStatus(status)
    this.details = body?.details
    this.status = status
  }
}

// Spring Security trả 403 rỗng (không qua GlobalExceptionHandler) khi request thiếu token.
function codeForStatus(status: number): string {
  if (status === 401 || status === 403) return 'UNAUTHORIZED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 422) return 'BUSINESS_RULE'
  if (status >= 500) return 'INTERNAL_ERROR'
  return 'UNKNOWN_ERROR'
}

function defaultMessage(status: number): string {
  if (status === 401 || status === 403) return 'Bạn cần đăng nhập'
  if (status === 409) return 'Dữ liệu đã tồn tại'
  if (status === 422) return 'Yêu cầu không hợp lệ'
  if (status >= 500) return 'Lỗi từ máy chủ'
  return 'Có lỗi xảy ra'
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
})

let refreshing: Promise<AuthTokenResponse | null> | null = null
let onUnauthorized: () => void = () => {}

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb
}

http.interceptors.request.use((config) => {
  const tokens = getTokens()
  if (tokens) config.headers.Authorization = `Bearer ${tokens.accessToken}`
  return config
})

// Refresh token xoay vòng bắt buộc một lượt: hai request 401 song song chỉ được đổi token một lần.
async function refreshTokens(): Promise<AuthTokenResponse | null> {
  const tokens = getTokens()
  if (!tokens) return null
  refreshing ??= axios
    .post<AuthTokenResponse>('/api/v1/auth/refresh', { refreshToken: tokens.refreshToken })
    .then((res) => {
      setTokens(res.data)
      return res.data
    })
    .catch(() => {
      clearTokens()
      return null
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const request = error.config as AxiosRequestConfig & { _retried?: boolean }
    const status = error.response?.status
    const isAuthEndpoint = request?.url?.includes('/auth/login') || request?.url?.includes('/auth/refresh')
    // Http403ForbiddenEntryPoint: token hết hạn bị coi là chưa đăng nhập → 403 rỗng, không bao giờ 401.
    // 403 do phân quyền đi qua GlobalExceptionHandler nên có body ApiError; chỉ 403 rỗng mới cần refresh.
    const body: unknown = error.response?.data
    const isAnonymousForbidden = status === 403 && (body == null || body === '')

    if ((status === 401 || isAnonymousForbidden) && request && !request._retried && !isAuthEndpoint) {
      request._retried = true
      const tokens = await refreshTokens()
      if (tokens) {
        request.headers = { ...request.headers, Authorization: `Bearer ${tokens.accessToken}` }
        return http(request)
      }
      onUnauthorized()
    }

    throw new ApiClientError(status ?? 0, error.response?.data)
  },
)

export { http }

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403)
}
