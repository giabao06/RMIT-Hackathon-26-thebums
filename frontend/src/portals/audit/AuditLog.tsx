import { cn } from 'cn'
import { useWorld } from '@/app/worldContext'
import { formatDateTime } from '@/lib/format'

/** The public log: every action that changed something, and no report content, names or tokens. */
export function AuditLog() {
  const { snapshot } = useWorld()
  const entries = [...snapshot.audit].reverse()

  return (
    <div className="flex flex-col">
      <h1 className="text-[22px] leading-tight font-semibold">Public audit log</h1>
      <p className="mt-1 max-w-[70ch] text-[14px] text-slate">
        Anyone can read this log. It records who acted and what happened, never what a report says, who wrote it or
        who it is about. Steward approvals and every refused key request appear here.
      </p>

      <div className="mt-6 flex items-center justify-between">
        <span className="tabular text-[13px] text-slate">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}, newest first</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[14px]">
          <thead>
            <tr className="text-left text-[12.5px] text-slate">
              <th className="w-[190px] py-2 pr-4 font-normal">Time</th>
              <th className="w-[170px] py-2 pr-4 font-normal">Actor</th>
              <th className="w-[230px] py-2 pr-4 font-normal">Event</th>
              <th className="py-2 font-normal">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.seq} className="border-t border-rule align-top">
                <td className="tabular py-3 pr-4 whitespace-nowrap text-slate">{formatDateTime(e.at)}</td>
                <td className="py-3 pr-4">{e.actor}</td>
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        e.tone === 'released' ? 'bg-active' : e.tone === 'refused' ? 'bg-danger' : 'bg-[#cbd5e1]',
                      )}
                    />
                    {e.action}
                  </span>
                </td>
                <td className="py-3 text-slate">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
