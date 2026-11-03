import { http } from './client'
import type { Conversation, Message, MessagePage, Page } from './types'

/** participantId là user id của phía còn lại; backend tự suy ra cột điền theo role người gọi. */
export async function createConversation(participantId: number, requestId?: number): Promise<Conversation> {
  const { data } = await http.post<Conversation>('/conversations', { participantId, requestId })
  return data
}

export async function fetchConversations(page = 0, size = 20): Promise<Page<Conversation>> {
  const { data } = await http.get<Page<Conversation>>('/conversations', { params: { page, size } })
  return data
}

/** Phân trang con trỏ: results mới nhất trước, lấy trang kế bằng nextBeforeId. */
export async function fetchMessages(conversationId: number, beforeId?: number, size = 50): Promise<MessagePage> {
  const { data } = await http.get<MessagePage>(`/conversations/${conversationId}/messages`, {
    params: { beforeId, size },
  })
  return data
}

export async function sendMessage(conversationId: number, content: string): Promise<Message> {
  const { data } = await http.post<Message>(`/conversations/${conversationId}/messages`, { content })
  return data
}

export async function markConversationRead(conversationId: number): Promise<void> {
  await http.post(`/conversations/${conversationId}/read`)
}
