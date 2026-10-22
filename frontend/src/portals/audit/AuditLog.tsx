import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { useWorld } from '@/app/worldContext'
import type { AuditEntry } from '@/escrow/simulation'
import { formatDateTime } from '@/lib/format'

const API_URL = import.meta.env.VITE_API_URL as string | undefined

interface Chain {
  intact: boolean
  brokenAt: number | null
  head: string | null
}

interface ApiEntry {
  seq: number
  at: string
  event: string
  caseId: string | null
}

// Roles only, never identities: the log records what happened, not who did it.
const EVENTS: Record<string, Pick<AuditEntry, 'actor' | 'action' | 'detail' | 'tone'>> = {
  report_sealed: { actor: 'Reporter', action: 'Report sealed', detail: 'Ciphertext stored. Nobody can read it.', tone: 'neutral' },
  case_eligible: { actor: 'System', action: 'Case eligible', detail: 'Two independent reports match. Waiting for steward approval.', tone: 'neutral' },
  approval: { actor: 'Steward', action: 'Steward approved', detail: 'One steward signed the release request.', tone: 'neutral' },
  released: { actor: 'Steward quorum', action: 'Reports released', detail: 'The quorum released the key to an investigator.', tone: 'released' },
  closed: { actor: 'System', action: 'Case closed', detail: 'The investigation ended.', tone: 'neutral' },
  withdrawn: { actor: 'Reporter', action: 'Withdrawn', detail: 'A reporter removed their report or contact details.', tone: 'neutral' },
  expired: { actor: 'System', action: 'Expired', detail: 'Unmatched ciphertext was permanently deleted.', tone: 'neutral' },
  settings_changed: { actor: 'Org admins', action: 'Settings changed', detail: 'Retention or quorum settings changed.', tone: 'neutral' },
  steward_added: { actor: 'Org admins', action: 'Steward added', detail: 'An admin quorum added a steward.', tone: 'neutral' },
  steward_removed: { actor: 'Org admins', action: 'Steward removed', detail: 'An admin quorum removed a steward.', tone: 'neutral' },
  steward_rotated: { actor: 'Org admins', action: 'Steward rotated', detail: 'An admin quorum replaced a steward.', tone: 'neutral' },
  investigator_added: { actor: 'Org admins', action: 'Investigator added', detail: 'An admin quorum added an investigator.', tone: 'neutral' },
  investigator_removed: { actor: 'Org admins', action: 'Investigator removed', detail: 'An admin quorum removed an investigator.', tone: 'neutral' },
  investigator_assigned: { actor: 'Org admin', action: 'Investigator assigned', detail: 'An investigator was assigned to a released case.', tone: 'neutral' },
  forgery_refused: { actor: 'Unknown caller', action: 'Forgery refused', detail: 'A forged credential or withdrawal proof was rejected.', tone: 'refused' },
  escalation_refused: { actor: 'Signed-in caller', action: 'Escalation refused', detail: 'A caller tried to use a role they do not hold.', tone: 'refused' },
}

const toEntry = (e: ApiEntry): AuditEntry => ({
  seq: e.seq,
  at: Date.parse(e.at),
  ...(EVENTS[e.event] ?? { actor: 'System', action: e.event, detail: '', tone: 'neutral' }),
})

/** The public log: every action that changed something, and no report content, names or tokens. */
export function AuditLog() {
  return API_URL ? <LiveAuditLog apiUrl={API_URL} /> : <SimulatedAuditLog />
}

function SimulatedAuditLog() {
  const { snapshot } = useWorld()
  return <AuditView entries={[...snapshot.audit].reverse()} />
}

function LiveAuditLog({ apiUrl }: { apiUrl: string }) {
  const [data, setData] = useState<{ entries: AuditEntry[]; chain: Chain } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch(`${apiUrl}/audit`)
        .then((r) => (r.ok ? (r.json() as Promise<Chain & { entries: ApiEntry[] }>) : Promise.reject(new Error('audit'))))
        .then((j) => {
          if (cancelled) return
          setData({ entries: j.entries.map(toEntry), chain: { intact: j.intact, brokenAt: j.brokenAt, head: j.head } })
          setError(false)
        })
        .catch(() => !cancelled && setError(true))
    void load()
    const timer = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [apiUrl])

  if (!data) {
    return <p className="text-[14px] text-slate">{error ? 'The audit log is unreachable right now.' : 'Loading the audit log…'}</p>
  }
  return <AuditView entries={data.entries} chain={data.chain} stale={error} />
}

function AuditView({ entries, chain, stale }: { entries: AuditEntry[]; chain?: Chain; stale?: boolean }) {
  return (
    <div className="flex flex-col">
      <h1 className="text-[22px] leading-tight font-semibold">Public audit log</h1>
      <p className="mt-1 max-w-[70ch] text-[14px] text-slate">
        Anyone can read this log. It records who acted and what happened, never what a report says, who wrote it or
        who it is about. Steward approvals and every refused key request appear here.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <span className="tabular text-[13px] text-slate">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}, newest first</span>
        {chain && (
          <span role="status" className={cn('tabular text-[13px]', chain.intact ? 'text-slate' : 'font-medium text-danger')}>
            {chain.intact ? 'Hash chain intact' : `Hash chain broken at entry ${chain.brokenAt}`}
            {chain.head && ` · head ${chain.head.slice(0, 12)}`}
            {stale && ' · connection lost, showing last data'}
          </span>
        )}
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
