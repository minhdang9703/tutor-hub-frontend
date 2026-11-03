import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageSquarePlus, RefreshCw, Search } from 'lucide-react'
import type { Conversation } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Badge, Button, Card, EmptyState, Input, PageNav, Spinner } from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import {
  CONVERSATION_PAGE_SIZE,
  conversationsQueryOptions,
  counterpartyOf,
  describeChatError,
  lastActivityLabel,
  useCreateConversation,
  validateNewChat,
} from './chatLogic'

export default function ConversationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  // Trang khác deep-link tới đây bằng ?participantId=&requestId= — xem dòng dưới cách suy giá trị.
  const deepLinkParticipant = searchParams.get('participantId') ?? ''
  const deepLinkRequest = searchParams.get('requestId') ?? ''
  const linkSource = `${deepLinkParticipant}
${deepLinkRequest}`

  // Nháp do người dùng gõ chỉ hợp lệ khi query param vẫn như lúc gõ; URL đổi thì giá trị suy lại từ param,
  // nhờ vậy không cần effect reset state (tránh hai lần render dây chuyền).
  const [draft, setDraft] = useState<{ participantId: string; requestId: string; source: string } | null>(null)
  const values =
    draft != null && draft.source === linkSource
      ? draft
      : { participantId: deepLinkParticipant, requestId: deepLinkRequest, source: linkSource }

  const [panelToggled, setPanelToggled] = useState<boolean | null>(null)
  const panelOpen = panelToggled ?? deepLinkParticipant.trim() !== ''

  const conversationsQuery = useQuery(conversationsQueryOptions(page))
  const createMutation = useCreateConversation()

  const pageResult = conversationsQuery.data
  const conversations = pageResult?.content ?? []

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validation = validateNewChat(values.participantId, values.requestId, user?.id)
    setFormError(validation.error)
    if (validation.error != null || validation.participantId == null) return

    createMutation.mutate(
      { participantId: validation.participantId, requestId: validation.requestId },
      { onSuccess: (conversation) => navigate(`/messages/${conversation.id}`) },
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tin nhắn</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hội thoại giữa phụ huynh và gia sư. Cuộc trò chuyện chỉ tạo được giữa hai người đã ghép cặp qua lịch học
            hoặc đơn ứng tuyển đã được chọn.
          </p>
        </div>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600">
          <ArrowLeft className="size-4" /> Về trang chủ
        </Link>
      </header>

      <Card
        title="Bắt đầu cuộc trò chuyện"
        actions={
          <Button variant="secondary" type="button" onClick={() => setPanelToggled(!panelOpen)}>
            <MessageSquarePlus className="size-4" /> {panelOpen ? 'Đóng biểu mẫu' : 'Mở biểu mẫu'}
          </Button>
        }
      >
        {!panelOpen ? (
          <p className="text-sm text-slate-500">
            <strong className="font-medium text-slate-700">ID người tham gia</strong> là user id của phía còn lại — với
            phụ huynh đó chính là id gia sư trong đường dẫn{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/tutors/&#123;id&#125;</code>. Trang khác có thể
            mở sẵn biểu mẫu qua <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/messages?participantId=…</code>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="ID người tham gia"
                placeholder="vd. 42"
                inputMode="numeric"
                value={values.participantId}
                onChange={(event) => setDraft({ participantId: event.target.value, requestId: values.requestId, source: linkSource })}
                hint="Bắt buộc. User id của gia sư hoặc phụ huynh, đang ACTIVE và đã có hồ sơ."
              />
              <Input
                label="ID yêu cầu tìm gia sư (không bắt buộc)"
                placeholder="vd. 7"
                inputMode="numeric"
                value={values.requestId}
                onChange={(event) => setDraft({ participantId: values.participantId, requestId: event.target.value, source: linkSource })}
                hint="Gắn hội thoại với một yêu cầu để hai bên dễ tra cứu."
              />
            </div>

            {formError != null && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {formError}
              </p>
            )}
            {createMutation.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {describeChatError(createMutation.error)}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={createMutation.isPending}>
                <MessageSquarePlus className="size-4" /> Tạo cuộc trò chuyện
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPanelToggled(false)}>
                Hủy
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Mỗi cặp phụ huynh – gia sư chỉ có một hội thoại (UNIQUE parent_id, tutor_id): nếu đã tồn tại, backend trả
              lại hội thoại cũ và bạn được chuyển thẳng tới đó.
            </p>
          </form>
        )}
      </Card>

      {conversationsQuery.isLoading && <Spinner />}

      {conversationsQuery.isError && (
        <EmptyState>
          <p>Không tải được danh sách cuộc trò chuyện. Hãy chắc chắn backend TutorHub đang chạy rồi thử lại.</p>
          <div className="mt-3 flex justify-center">
            <Button variant="secondary" onClick={() => void conversationsQuery.refetch()}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
          </div>
        </EmptyState>
      )}

      {!conversationsQuery.isLoading && !conversationsQuery.isError && conversations.length === 0 && (
        <EmptyState>
          <p className="flex items-center justify-center gap-2">
            <Search className="size-4" /> Bạn chưa có cuộc trò chuyện nào.
          </p>
          <p className="mt-1 text-xs">
            {user?.role === 'TUTOR'
              ? 'Phụ huynh thường nhắn trước sau khi bạn ứng tuyển hoặc sau khi một buổi học được xác nhận.'
              : 'Hãy nhắn cho gia sư bạn đã chọn, mở từ trang hồ sơ gia sư hoặc danh sách lịch học.'}
          </p>
        </EmptyState>
      )}

      {conversations.length > 0 && (
        <Card
          title="Cuộc trò chuyện của bạn"
          actions={
            <Badge tone="slate">
              {pageResult?.totalElements ?? 0} hội thoại · trang {page + 1}/{Math.max(pageResult?.totalPages ?? 1, 1)}
            </Badge>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Danh sách sắp theo <code className="rounded bg-slate-100 px-1 py-0.5">last_message_at</code> giảm dần,{' '}
              {CONVERSATION_PAGE_SIZE} mục mỗi trang. Backend không trả số tin chưa đọc theo từng cuộc trò chuyện (chỉ có{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">read_at</code> của từng tin trong{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">/conversations/&#123;id&#125;/messages</code>), nên đây không
              hiển thị huy hiệu chưa đọc thay vì gọi thêm một request cho mỗi dòng.
            </p>
            {conversations.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} viewerId={user?.id} />
            ))}
          </div>
          <div className="mt-4">
            <PageNav page={page} totalPages={pageResult?.totalPages ?? 1} onChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  )
}

function ConversationRow({ conversation, viewerId }: { conversation: Conversation; viewerId: number | undefined }) {
  const navigate = useNavigate()
  const counterparty = viewerId == null ? null : counterpartyOf(conversation, viewerId)
  const label = counterparty?.label ?? 'Cuộc trò chuyện'
  const href = `/messages/${conversation.id}`

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={href} className="font-semibold text-slate-900 hover:text-brand-700">
              {counterparty != null ? `${label} · #${counterparty.otherUserId}` : `${label} #${conversation.id}`}
            </Link>
            {conversation.lastMessageAt == null && <Badge tone="slate">Chưa có tin nhắn</Badge>}
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {lastActivityLabel(conversation)}
            {conversation.lastMessageAt != null && (
              <span className="text-slate-400"> · {formatDateTime(conversation.lastMessageAt)}</span>
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Mở từ {formatDateTime(conversation.createdAt)}
            {conversation.requestId != null && (
              <>
                {' · '}
                <Link to={`/requests/${conversation.requestId}`} className="text-brand-600 hover:underline">
                  Yêu cầu #{conversation.requestId}
                </Link>
              </>
            )}
            {counterparty?.profileHref != null && (
              <>
                {' · '}
                <Link to={counterparty.profileHref} className="text-brand-600 hover:underline">
                  Hồ sơ gia sư
                </Link>
              </>
            )}
          </p>
        </div>

        <Button variant="secondary" onClick={() => navigate(href)}>
          Mở hội thoại
        </Button>
      </div>
    </article>
  )
}
