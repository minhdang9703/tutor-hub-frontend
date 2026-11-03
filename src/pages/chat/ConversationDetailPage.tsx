import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertOctagon, ArrowLeft, Flag, RefreshCw, Send, TriangleAlert } from 'lucide-react'
import { clsx } from 'clsx'
import type { Message } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Button, Card, EmptyState, Select, Spinner, Textarea } from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_REPORT_REASONS,
  REPORT_DESCRIPTION_MAX,
  REPORT_REASON_MAX,
  counterpartyOf,
  describeChatError,
  parsePositiveId,
  relativeTime,
  useConversationById,
  useConversationMessages,
  useMarkConversationRead,
  useReportMessage,
  useSendMessage,
  validateMessageContent,
} from './chatLogic'

export default function ConversationDetailPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const conversationId = parsePositiveId(params.id)
  const viewerId = user?.id

  // Key ['chat','conversation',id,'messages',beforeId] cần id hợp lệ; dùng 0 khi URL sai để tắt query.
  const safeId = conversationId ?? 0
  const messages = useConversationMessages(safeId)
  const { conversation, isLoading: isMetaLoading } = useConversationById(safeId)
  const markRead = useMarkConversationRead(safeId)
  const [reportTarget, setReportTarget] = useState<Message | null>(null)

  const counterparty = conversation != null && viewerId != null ? counterpartyOf(conversation, viewerId) : null
  const newestId = messages.messages.length > 0 ? messages.messages[messages.messages.length - 1].id : null

  const newestIncomingId = useMemo(() => {
    if (viewerId == null) return null
    for (let index = messages.messages.length - 1; index >= 0; index -= 1) {
      const item = messages.messages[index]
      if (item.senderId !== viewerId) return item.id
    }
    return null
  }, [messages.messages, viewerId])

  // POST /conversations/{id}/read: 204, đánh dấu mọi tin của phía kia. Gọi khi mở hội thoại, khi có
  // tin mới của phía kia và khi tab quay lại trạng thái hiển thị (không có websocket để đẩy tin).
  useEffect(() => {
    if (conversationId == null || viewerId == null) return
    const mark = () => {
      if (document.visibilityState === 'visible') markRead.mutate()
    }
    // newestIncomingId đổi từ null -> id ngay sau khi tải lượt tin đầu, nên lượt gọi này chính là "mở".
    mark()
    document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
    // markRead.mutate ổn định theo conversationId; không đưa cả object mutation vào deps để tránh lặp vô hạn.
  }, [conversationId, viewerId, newestIncomingId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scrollerRef = useRef<HTMLDivElement>(null)

  // Cuộn xuống tin mới nhất khi mở hội thoại hoặc khi có tin mới; giữ nguyên khi chỉ tải tin cũ hơn.
  useLayoutEffect(() => {
    const element = scrollerRef.current
    if (element != null && newestId != null) element.scrollTop = element.scrollHeight
  }, [newestId])

  if (conversationId == null) {
    return (
      <EmptyState>
        <p>Đường dẫn hội thoại không hợp lệ — ID phải là số nguyên dương.</p>
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" onClick={() => navigate('/messages')}>
            <ArrowLeft className="size-4" /> Về danh sách hội thoại
          </Button>
        </div>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">
            {counterparty != null ? `${counterparty.label} · #${counterparty.otherUserId}` : `Hội thoại #${conversationId}`}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {counterparty?.profileHref != null ? (
              <Link to={counterparty.profileHref} className="text-brand-600 hover:underline">
                Xem hồ sơ gia sư
              </Link>
            ) : (
              'Phía phụ huynh không có trang hồ sơ công khai để liên kết.'
            )}
            {conversation?.requestId != null && (
              <>
                {' · '}
                <Link to={`/requests/${conversation.requestId}`} className="text-brand-600 hover:underline">
                  Yêu cầu #{conversation.requestId}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/messages"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="size-4" /> Danh sách
          </Link>
          <Button variant="secondary" onClick={() => void messages.refetch()}>
            <RefreshCw className="size-4" /> Tải lại
          </Button>
        </div>
      </header>

      {!isMetaLoading && conversation == null && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Không thấy hội thoại này trong danh sách của bạn (backend không có <code className="rounded bg-white px-1 py-0.5">GET /conversations/&#123;id&#125;</code>),
          nhưng khung tin nhắn vẫn dùng được nếu bạn là thành viên.
        </p>
      )}

      <Card>
        <div
          ref={scrollerRef}
          role="log"
          aria-label="Khung trò chuyện"
          aria-live="polite"
          className="max-h-[58vh] space-y-3 overflow-y-auto pr-1"
        >
          {messages.isLoading && <Spinner />}

          {messages.isError && (
            <EmptyState>
              <p>Không tải được tin nhắn. Kiểm tra lại đường dẫn và xác nhận bạn là thành viên của hội thoại.</p>
              <div className="mt-3 flex justify-center">
                <Button variant="secondary" onClick={() => void messages.refetch()}>
                  <RefreshCw className="size-4" /> Thử lại
                </Button>
              </div>
            </EmptyState>
          )}

          {!messages.isLoading && !messages.isError && messages.messages.length === 0 && (
            <EmptyState>Chưa có tin nhắn nào. Hãy gửi lời nhắn đầu tiên ở khung bên dưới.</EmptyState>
          )}

          {messages.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="ghost" type="button" loading={messages.isLoadingOlder} onClick={messages.loadOlder}>
                Tải tin nhắn cũ hơn
              </Button>
            </div>
          )}

          {messages.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isMine={viewerId != null && message.senderId === viewerId}
              onReport={viewerId != null && message.senderId !== viewerId ? () => setReportTarget(message) : undefined}
            />
          ))}
        </div>

        {/* key theo id để nháp chưa gửi của hội thoại cũ không bị mang sang hội thoại mới. */}
        <Composer key={conversationId} conversationId={conversationId} />
      </Card>

      {reportTarget != null && <ReportDialog message={reportTarget} onClose={() => setReportTarget(null)} />}

      <p className="text-xs text-slate-500">
        Tin nhắn bị chặn ở {MESSAGE_MAX_LENGTH} ký tự đúng theo <code className="rounded bg-slate-100 px-1 py-0.5">@Size(max = 4000)</code>{' '}
        của backend. Sau mỗi lần gửi, mọi trang tin của hội thoại và danh sách hội thoại được tải lại vì{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5">last_message_at</code> quyết định thứ tự sắp xếp.
      </p>
    </div>
  )
}

function Composer({ conversationId }: { conversationId: number }) {
  const send = useSendMessage(conversationId)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validateMessageContent(draft)
    setError(validation)
    if (validation != null) return
    send.mutate(draft.trim(), {
      onSuccess: () => {
        setDraft('')
        setError(null)
      },
    })
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
      <Textarea
        label="Tin nhắn"
        placeholder="Nhập nội dung… (Enter để gửi, Shift + Enter để xuống dòng)"
        value={draft}
        rows={3}
        maxLength={MESSAGE_MAX_LENGTH}
        className={clsx(draft.length >= MESSAGE_MAX_LENGTH && 'border-amber-500')}
        hint={`${draft.length}/${MESSAGE_MAX_LENGTH} ký tự`}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (error != null) setError(validateMessageContent(next))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />

      {error != null && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {send.isError && (
        <p className="text-sm text-red-600" role="alert">
          {describeChatError(send.error)}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-xs text-slate-500">
          Khi buổi học chưa được xác nhận, backend tự đánh dấu tin chứa đường link, số điện thoại hoặc từ khóa
          chuyển khoản (momo, vietqr, bank…).
        </p>
        <Button type="submit" loading={send.isPending} disabled={draft.trim() === ''}>
          <Send className="size-4" /> Gửi
        </Button>
      </div>
    </form>
  )
}

function MessageBubble({
  message,
  isMine,
  onReport,
}: {
  message: Message
  isMine: boolean
  onReport?: (() => void) | undefined
}) {
  return (
    <article className={clsx('flex', isMine ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[85%] space-y-1">
        <div
          className={clsx(
            'rounded-2xl border px-4 py-2.5 text-sm shadow-sm',
            isMine ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white',
            message.caution && 'border-amber-500 bg-amber-50',
          )}
        >
          <p className="whitespace-pre-wrap break-words text-slate-900">{message.content}</p>
          {message.caution && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Nội dung bị đánh dấu cảnh báo
            </p>
          )}
        </div>

        <div className={clsx('flex flex-wrap items-center gap-2 text-xs text-slate-500', isMine ? 'justify-end' : 'justify-start')}>
          <span title={formatDateTime(message.createdAt)}>{relativeTime(message.createdAt)}</span>
          {isMine && <span>{message.readAt == null ? 'Chưa đọc' : `Đã đọc ${relativeTime(message.readAt)}`}</span>}
          {onReport != null && (
            <button
              type="button"
              onClick={onReport}
              className="inline-flex items-center gap-1 rounded px-1 font-medium text-slate-400 transition hover:text-red-600"
              aria-label={`Báo cáo tin nhắn ${message.id}`}
            >
              <Flag className="size-3.5" /> Báo cáo
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function ReportDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const report = useReportMessage()
  const [reason, setReason] = useState<string>(MESSAGE_REPORT_REASONS[0])
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (trimmedReason === '') {
      setError('Chọn hoặc nhập lý do báo cáo (tối đa 40 ký tự).')
      return
    }
    if (trimmedReason.length > REPORT_REASON_MAX) {
      setError(`Lý do tối đa ${REPORT_REASON_MAX} ký tự.`)
      return
    }
    if (description.length > REPORT_DESCRIPTION_MAX) {
      setError(`Mô tả tối đa ${REPORT_DESCRIPTION_MAX} ký tự.`)
      return
    }
    setError(null)
    report.mutate({ messageId: message.id, reason: trimmedReason, description: description.trim() || undefined }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onClick={onClose}>
      <form
        role="presentation"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <AlertOctagon className="size-5 text-red-600" /> Báo cáo tin nhắn #{message.id}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Báo cáo được gửi tới <code className="rounded bg-slate-100 px-1 py-0.5">POST /reports</code> với{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">targetType = MESSAGE</code> để quản trị viên xử lý.
        </p>

        <blockquote className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {message.content.slice(0, 300)}
          {message.content.length > 300 && '…'}
        </blockquote>

        <div className="mt-4 space-y-4">
          <Select
            label="Lý do"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint={`Tối đa ${REPORT_REASON_MAX} ký tự theo @Size của ReportRequest.reason.`}
          >
            {MESSAGE_REPORT_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>

          <Textarea
            label="Mô tả thêm (không bắt buộc)"
            value={description}
            rows={4}
            maxLength={REPORT_DESCRIPTION_MAX}
            onChange={(event) => setDescription(event.target.value)}
            hint={`${description.length}/${REPORT_DESCRIPTION_MAX} ký tự`}
          />

          {error != null && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          {report.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {describeChatError(report.error)}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="danger" loading={report.isPending}>
            Gửi báo cáo
          </Button>
        </div>
      </form>
    </div>
  )
}
