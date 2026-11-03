import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Fingerprint, RefreshCw, ScrollText } from 'lucide-react'
import { fetchAuditLogs } from '../../api/admin'
import { ApiClientError } from '../../api/client'
import { formatDateTime } from '../../lib/format'
import { Badge, Button, Card, EmptyState, Input, PageNav, Spinner } from '../../components/ui'
import { ADMIN_PAGE_SIZE, auditActionLabel, auditEntityLabel, entityRefLabel, notifyQueryError, userRefLabel } from './adminLabels'

export default function AuditPanel() {
  const [page, setPage] = useState(0)
  const [term, setTerm] = useState('')

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () => fetchAuditLogs(page, ADMIN_PAGE_SIZE),
  })

  // Memo hoá `rows` theo object data (ổn định giữa các render) để useMemo bên dưới không chạy lại vô nghĩa.
  const data = auditQuery.data
  const rows = useMemo(() => data?.content ?? [], [data])
  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => {
      const haystack = [
        row.action,
        auditActionLabel(row.action),
        row.entityType,
        auditEntityLabel(row.entityType),
        row.entityId == null ? '' : `#${row.entityId}`,
        row.actorId == null ? '' : `#${row.actorId}`,
        row.ipAddress ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [rows, term])

  return (
    <div className="space-y-6">
      <Card title="Nhật ký hoạt động">
        {auditQuery.isLoading && <Spinner />}
        {auditQuery.isError && (
          <EmptyState>
            <p className="mb-1 font-medium text-slate-700">
              {auditQuery.error instanceof ApiClientError && auditQuery.error.status === 403
                ? 'Bạn không có vai trò ADMIN nên /admin/audit-logs trả 403.'
                : 'Không tải được nhật ký hệ thống.'}
            </p>
            <p className="mb-3">
              Kiểm tra backend đang chạy tại{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://localhost:8080</code>.
            </p>
            <Button variant="secondary" onClick={() => void auditQuery.refetch().then(notifyQueryError)}>
              <RefreshCw className="size-4" /> Thử lại
            </Button>
          </EmptyState>
        )}

        {!auditQuery.isLoading && !auditQuery.isError && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Input
                label="Tìm theo hành động, đối tượng hoặc id"
                className="w-80"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="vd: TUTOR_VERIFIED, #12, tạm khóa"
                hint="Bộ lọc chạy trên máy và chỉ áp dụng cho trang đang xem; /admin/audit-logs không nhận tham số lọc."
              />
              {auditQuery.data && (
                <p className="text-sm text-slate-500">
                  {auditQuery.data.totalElements} dòng nhật ký · {filtered.length}/{rows.length} trên trang này
                </p>
              )}
            </div>

            {rows.length === 0 ? (
              <EmptyState>
                <p className="mb-1 font-medium text-slate-700">Nhật ký còn trống.</p>
                <p>Bản ghi xuất hiện khi có quyết định của admin hoặc lượt xác nhận/hủy buổi học của gia sư, phụ huynh.</p>
              </EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState>Trang này không có dòng nào khớp từ khóa.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-medium">Thời điểm</th>
                      <th className="py-2 pr-3 font-medium">Người thực hiện</th>
                      <th className="py-2 pr-3 font-medium">Hành động</th>
                      <th className="py-2 pr-3 font-medium">Đối tượng</th>
                      <th className="py-2 font-medium">Địa chỉ IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => {
                      const known = auditActionLabel(log.action) !== log.action
                      return (
                        <tr key={log.id} className="border-b border-slate-100 align-top">
                          <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-slate-500">
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700">
                            {log.actorId == null ? (
                              <span className="text-slate-400">Không rõ (tài khoản đã bị xóa)</span>
                            ) : (
                              userRefLabel(log.actorId)
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-800">{auditActionLabel(log.action)}</span>
                              {known ? (
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{log.action}</code>
                              ) : (
                                <Badge tone="amber">Chưa ánh xạ nhãn</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700">
                            {entityRefLabel(log.entityType, log.entityId)}
                          </td>
                          <td className="py-2.5 text-slate-500">{log.ipAddress || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {auditQuery.data && (
              <PageNav page={auditQuery.data.page} totalPages={auditQuery.data.totalPages} onChange={setPage} />
            )}
          </div>
        )}
      </Card>

      <Card title="Đọc nhật ký thế nào?">
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <ScrollText className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <span>
              <code className="rounded bg-slate-100 px-1 text-xs">action</code> và{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">entity_type</code> là chuỗi tự do do backend ghi, nên
              bảng này dịch sẵn các giá trị thực sự tồn tại (USER_*, TUTOR_*, DOCUMENT_*, REPORT_RESOLVED, REVIEW_HIDDEN,
              BOOKING_*) và giữ nguyên mã gốc nếu gặp giá trị mới.
            </span>
          </li>
          <li className="flex gap-2">
            <Fingerprint className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <span>
              Cột IP thường trống: cả AdminService lẫn AuditService đều ghi INSERT mà không đặt cột ip_address, dù bảng
              có cột này. Bộ đếm dòng và id người dùng cũng không tra được tên vì backend không có endpoint tra user theo
              id cho admin.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
