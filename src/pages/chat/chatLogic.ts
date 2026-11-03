import { useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale/vi'
import toast from 'react-hot-toast'
import {
  createConversation,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
} from '../../api/chat'
import { createReport } from '../../api/booking'
import { ApiClientError } from '../../api/client'
import type { Conversation, Message } from '../../api/types'
import { formatDateTime } from '../../lib/format'

// ---------------------------------------------------------------- ràng buộc backend

/** /conversations?page&size dùng PageResponse; size được clamp 1..100 phía server. */
export const CONVERSATION_PAGE_SIZE = 20

/** Kích thước mỗi trang tin nhắn — cũng là default của backend (Math.clamp(size,1,100)). */
export const MESSAGE_PAGE_SIZE = 50

/** MessageRequest.content: @NotBlank @Size(max = 4000) (cột content VARCHAR(4000)). */
export const MESSAGE_MAX_LENGTH = 4000

/** ReportRequest.reason: @NotBlank @Size(max = 40); description: @Size(max = 2000). */
export const REPORT_REASON_MAX = 40
export const REPORT_DESCRIPTION_MAX = 2000

/** Không có websocket: chỉ trang lượt tin mới nhất được quay lại sau 15 giây để hội thoại "sống". */
export const MESSAGE_POLL_INTERVAL_MS = 15_000

/** Không có GET /conversations/{id}, nên trang chi tiết phải quét danh sách để lấy tiêu đề. */
export const CONVERSATION_LOOKUP_SIZE = 100
export const CONVERSATION_LOOKUP_MAX_PAGES = 20

/** Lý do báo cáo gợi ý; mọi giá trị đều nằm trong giới hạn 40 ký tự của backend. */
export const MESSAGE_REPORT_REASONS: string[] = [
  'Tiếp xúc ngoài nền tảng',
  'Đề nghị chuyển khoản trực tiếp',
  'Nội dung lừa đảo',
  'Quấy rối, làm phiền',
  'Thông tin sai lệch',
  'Nội dung không phù hợp',
]

// ---------------------------------------------------------------- query keys

export const conversationsKey = (page: number) => ['chat', 'conversations', page] as const

/** Trang đầu tiên không gửi beforeId; dùng null làm sentinel để key luôn có 5 phần tử. */
export const messagesKey = (conversationId: number, beforeId: number | null) =>
  ['chat', 'conversation', conversationId, 'messages', beforeId] as const

export const conversationMetaKey = (conversationId: number) => ['chat', 'conversation', conversationId, 'meta'] as const

export function invalidateConversations(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
}

export function invalidateConversationMessages(queryClient: QueryClient, conversationId: number) {
  queryClient.invalidateQueries({ queryKey: ['chat', 'conversation', conversationId, 'messages'] })
}

export function conversationsQueryOptions(page: number) {
  return {
    queryKey: conversationsKey(page),
    queryFn: () => fetchConversations(page, CONVERSATION_PAGE_SIZE),
  }
}

export function messagesQueryOptions(conversationId: number, beforeId: number | null) {
  return {
    queryKey: messagesKey(conversationId, beforeId),
    queryFn: () => fetchMessages(conversationId, beforeId ?? undefined, MESSAGE_PAGE_SIZE),
  }
}

// ---------------------------------------------------------------- diễn giải dữ liệu

/**
 * Conversation chỉ lưu parentId/tutorId và backend không có endpoint đọc user theo id,
 * nên UI chỉ gọi được phía còn lại theo vai của người xem. Link hồ sơ chỉ tồn tại cho phụ huynh
 * (GET /tutors/{id} là endpoint công khai của gia sư đã xác minh).
 */
export interface Counterparty {
  label: string
  otherUserId: number
  profileHref: string | null
}

export function counterpartyOf(conversation: Conversation, viewerId: number): Counterparty {
  if (conversation.tutorId === viewerId) {
    return { label: 'Phụ huynh', otherUserId: conversation.parentId, profileHref: null }
  }
  return { label: 'Gia sư', otherUserId: conversation.tutorId, profileHref: `/tutors/${conversation.tutorId}` }
}

export function relativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return formatDateTime(iso)
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: viLocale })
  } catch {
    return formatDateTime(iso)
  }
}

export function lastActivityLabel(conversation: Conversation): string {
  return conversation.lastMessageAt ? relativeTime(conversation.lastMessageAt) : 'Chưa có tin nhắn'
}

/** /conversations không trả số tin chưa đọc; read_at chỉ có trong từng tin nhắn nên không suy đoán. */
export function parsePositiveId(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export interface NewChatValidation {
  error: string | null
  participantId?: number
  requestId?: number
}

/** participantId phải là user id của phía còn lại; requestId là tùy chọn (cột request_id nullable). */
export function validateNewChat(participantId: string, requestId: string, viewerId: number | undefined): NewChatValidation {
  const participant = parsePositiveId(participantId)
  if (participant == null) return { error: 'ID người tham gia phải là số nguyên dương (user id của gia sư hoặc phụ huynh).' }
  if (viewerId != null && participant === viewerId) return { error: 'Không thể mở cuộc trò chuyện với chính mình.' }

  const trimmedRequest = requestId.trim()
  if (trimmedRequest !== '') {
    const request = parsePositiveId(trimmedRequest)
    if (request == null) return { error: 'ID yêu cầu tìm gia sư không hợp lệ (điền số hoặc để trống).' }
    return { error: null, participantId: participant, requestId: request }
  }
  return { error: null, participantId: participant }
}

/** @NotBlank + @Size(max = 4000): chặn cả ô chỉ chứa khoảng trắng và nội dung quá dài. */
export function validateMessageContent(raw: string): string | null {
  if (raw.trim() === '') return 'Tin nhắn không được để trống.'
  if (raw.length > MESSAGE_MAX_LENGTH) return `Tin nhắn tối đa ${MESSAGE_MAX_LENGTH} ký tự (hiện có ${raw.length}).`
  return null
}

export function describeChatError(error: unknown): string {
  if (error instanceof ApiClientError) {
    // Message gốc của ChatService/ReportService là tiếng Anh; giữ nguyên để người dùng đối chiếu được
    // với log, kèm gợi ý hành động ở dòng dưới trong UI.
    if (error.code === 'NOT_FOUND') {
      return `${error.message} — ID phải là user id của tài khoản gia sư/phụ huynh đang ACTIVE và đã có hồ sơ.`
    }
    if (error.code === 'UNAUTHORIZED') return 'Bạn cần đăng nhập bằng tài khoản phụ huynh hoặc gia sư để nhắn tin.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Có lỗi xảy ra.'
}

// ---------------------------------------------------------------- hooks

export interface CreateConversationVariables {
  participantId: number
  requestId?: number
}

/**
 * UNIQUE(parent_id, tutor_id) + catch DataIntegrityViolation trong ChatService.make create
 * idempotent: mở lại cuộc trò chuyện đã có sẽ trả về conversation cũ với mã 201.
 */
export function useCreateConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ participantId, requestId }: CreateConversationVariables) => createConversation(participantId, requestId),
    onSuccess: () => invalidateConversations(queryClient),
  })
}

export function useSendMessage(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => sendMessage(conversationId, content),
    onSuccess: () => {
      invalidateConversationMessages(queryClient, conversationId)
      // lastMessage_at quyết định thứ tự danh sách nên phải tải lại sau mỗi lần gửi.
      invalidateConversations(queryClient)
    },
  })
}

export function useMarkConversationRead(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markConversationRead(conversationId),
    onSuccess: () => invalidateConversationMessages(queryClient, conversationId),
  })
}

export interface MessageReportVariables {
  messageId: number
  reason: string
  description?: string
}

export function useReportMessage() {
  return useMutation({
    mutationFn: ({ messageId, reason, description }: MessageReportVariables) =>
      createReport({ targetType: 'MESSAGE', targetId: messageId, reason, description }),
    onSuccess: () => toast.success('Đã gửi báo cáo tới quản trị viên.'),
  })
}

/**
 * Trang tin nhắn mới nhất nằm ĐẦU mảng `content` (backend order by id desc) và trả `nextBeforeId`
 * để lùi về phía tin cũ. Giữ một danh sách con trỏ [null, c1, c2…] — null là trang đầu — rồi nối
 * theo thứ tự mới→cũ và đảo ngược một lần để có cột chat cũ→mới.
 */
export function useConversationMessages(conversationId: number) {
  // Con trỏ đã tải gắn với một hội thoại cụ thể. So sánh id ngay khi render thay vì reset bằng effect
  // để đổi hội thoại không kéo theo hai lần render liên tiếp.
  const [state, setState] = useState<{ conversationId: number; cursors: Array<number | null> }>(() => ({
    conversationId,
    cursors: [null],
  }))
  const cursors = state.conversationId === conversationId ? state.cursors : [null]

  const enabled = conversationId > 0
  const results = useQueries({
    queries: cursors.map((beforeId) => ({
      ...messagesQueryOptions(conversationId, beforeId),
      enabled,
      // Chỉ trang mới nhất quay vòng; các trang cũ đã tải là dữ liệu bất biến.
      refetchInterval: beforeId == null ? MESSAGE_POLL_INTERVAL_MS : false,
    })),
  })

  // Trang mới hơn luôn đứng trước trong `cursors`, nên nối rồi đảo là ra thứ tự thời gian tăng dần.
  const ascending = results
    .map((result) => result.data?.content)
    .filter((content): content is Message[] => content != null)
    .flat()
    .reverse()

  const oldestResult = results[results.length - 1]
  // Con trỏ kế tiếp lấy từ trang CUỐI ĐÃ TẢI: trong lúc trang cũ hơn đang fetch thì nút "tải thêm"
  // vẫn còn tác dụng và không bị ẩn rồi hiện lại.
  const lastLoaded = [...results].reverse().find((result) => result.data != null) ?? oldestResult
  const nextBeforeId = lastLoaded?.data?.nextBeforeId ?? null
  const firstPage = results[0]

  return {
    messages: ascending,
    isLoading: firstPage?.isLoading ?? true,
    isError: firstPage?.isError ?? false,
    error: firstPage?.error ?? null,
    refetch: () => {
      for (const result of results) void result.refetch()
    },
    hasNextPage: nextBeforeId != null,
    isLoadingOlder: oldestResult?.isFetching ?? false,
    loadOlder: () => {
      if (nextBeforeId == null) return
      setState((previous) => {
        const base = previous.conversationId === conversationId ? previous.cursors : [null]
        return { conversationId, cursors: base.includes(nextBeforeId) ? base : [...base, nextBeforeId] }
      })
    },
  }
}

/**
 * Không có GET /conversations/{id}: quét danh sách có phân trang (size 100) cho tới khi thấy id,
 * dừng ở totalPages để không gọi vô hạn.
 */
export function useConversationById(conversationId: number) {
  const query = useQuery({
    queryKey: conversationMetaKey(conversationId),
    queryFn: async () => {
      for (let page = 0; page < CONVERSATION_LOOKUP_MAX_PAGES; page += 1) {
        const result = await fetchConversations(page, CONVERSATION_LOOKUP_SIZE)
        const found = result.content.find((item) => item.id === conversationId)
        if (found) return found
        if (page >= result.totalPages - 1) break
      }
      return null
    },
    enabled: conversationId > 0,
    retry: false,
  })

  return { conversation: query.data ?? null, isLoading: query.isLoading, refetch: query.refetch }
}
