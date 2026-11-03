import { CalendarCheck, TriangleAlert } from 'lucide-react'
import type { RecurringResult } from '../../api/booking'
import { formatDateTime } from '../../lib/format'
import { timeRange } from './bookingLogic'

interface Props {
  result: RecurringResult
  anchorStartAt: string
  onReset: () => void
}

function weekNumber(iso: string, anchorIso: string): number {
  const days = (new Date(iso).getTime() - new Date(anchorIso).getTime()) / 86_400_000
  return Math.max(1, Math.round(days / 7) + 1)
}

export default function RecurringResultView({ result, anchorStartAt, onReset }: Props) {
  const { created, failed } = result

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200">
        <p className="flex items-center gap-2 font-medium">
          <CalendarCheck className="size-5" /> Đã tạo {created.length} buổi học định kỳ
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          {failed.length > 0
            ? 'Một vài tuần bị bỏ qua vì trùng lịch — các buổi còn lại vẫn được tạo bình thường.'
            : 'Phụ huynh và gia sư cùng chờ xác nhận từ gia sư.'}
        </p>
      </div>

      {created.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Các buổi đã tạo</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-sm">
            {created.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 px-1.5 py-1">
                <span className="text-slate-700">
                  Tuần {weekNumber(b.startAt, anchorStartAt)} · {formatDateTime(b.startAt)}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{timeRange(b)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <TriangleAlert className="size-4" /> {failed.length} buổi không đặt được
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {failed.map((f, i) => (
              <li key={`${f.startAt}-${i}`}>
                Tuần {weekNumber(f.startAt, anchorStartAt)} · {formatDateTime(f.startAt)}
                {f.message ? ` — ${f.message}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">
            Trùng lịch (mã {failed[0]?.code ?? 'BOOKING_OVERLAP'}) nghĩa gia sư đã có buổi khác trong khung giờ đó.
          </p>
        </div>
      )}

      {created.length === 0 && (
        <p className="text-sm text-slate-500">
          Không tạo được buổi nào. Hãy thử dịch sang khung giờ khác hoặc chọn ít buổi hơn.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Đặt lịch khác
        </button>
      </div>
    </div>
  )
}
