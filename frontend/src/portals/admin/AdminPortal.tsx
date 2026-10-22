import { Suspense, lazy, useMemo, useState } from 'react'
import { useTideConfigured } from '@/app/tideContext'
import { Download, ShieldAlert } from 'lucide-react'
import { cn } from 'cn'
import { Link } from '@/app/Link'
import { ROUTES } from '@/app/router'
import { devScenario } from '@/app/scenarios'
import { useWorld } from '@/app/worldContext'
import { UnderlineTabs } from '@/components/UnderlineTabs'
import { Button } from '@/components/ui/button'
import { formatBytes, type AttackResult } from '@/escrow/simulation'
import { formatDate, formatDateTime, formatTime } from '@/lib/format'
import { DenyModal } from './DenyModal'

type Tab = 'reports' | 'stewards' | 'requests'

const AdminLive = lazy(() => import('./AdminLive').then((m) => ({ default: m.AdminLive })))
const API_URL = import.meta.env.VITE_API_URL as string | undefined

/** With a Tide realm and the API, org admins use the real backend; otherwise the attack demo. */
export function AdminPortal() {
  const tide = useTideConfigured()
  if (tide && API_URL) {
    return (
      <Suspense fallback={<p className="text-[14px] text-slate">Connecting to Tide…</p>}>
        <AdminLive apiUrl={API_URL} />
      </Suspense>
    )
  }
  return <SimulatedAdmin />
}

function SimulatedAdmin() {
  const { world, snapshot } = useWorld()
  const [tab, setTab] = useState<Tab>('reports')
  const [busy, setBusy] = useState<string | null>(null)
  const [modal, setModal] = useState<AttackResult | null>(() =>
    devScenario() === 'attacked' ? (snapshot.attacks.find((a) => a.kind === 'force-decrypt') ?? null) : null,
  )
  const [error, setError] = useState<string | null>(null)

  // The admin goes after the case closest to opening: the eligible one, else the largest.
  const target = useMemo(() => {
    const open = snapshot.cases.filter((c) => !snapshot.opened[c.caseId])
    const pool = open.length ? open : snapshot.cases
    return [...pool].sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.reportIds.length - a.reportIds.length)[0]
  }, [snapshot])

  async function run(label: string, attack: () => Promise<AttackResult> | AttackResult, showModal = false) {
    setBusy(label)
    setError(null)
    try {
      const result = await attack()
      if (showModal) setModal(result)
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  function exportDump() {
    void run('export', () => {
      const result = world.dumpDatabase()
      const blob = new Blob([JSON.stringify(world.getSnapshot().rows, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `safethreshold-dump-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      return result
    })
  }

  const storedBytes = snapshot.rows.reduce(
    (sum, r) => sum + r.ciphertextBytes + r.contactBytes + r.attachmentBytes.reduce((a, b) => a + b, 0),
    0,
  )

  const tabs = [
    { id: 'reports' as const, label: 'Sealed reports', count: snapshot.rows.length },
    { id: 'stewards' as const, label: 'Steward table', count: snapshot.stewardTable.length },
    { id: 'requests' as const, label: 'Key requests', count: snapshot.batches.length },
  ]

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[22px] leading-tight font-semibold">Admin IT view</h1>
          <p className="mt-1 max-w-[68ch] text-[14px] text-slate">
            Full database access, as the platform’s own IT admin has it. Every row is ciphertext and a hashed blinded
            token. No key or key share is stored here, so there is nothing to decrypt with.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={() => void run('dictionary', () => world.dictionaryAttack())} disabled={busy !== null || snapshot.rows.length === 0}>
            {busy === 'dictionary' ? 'Hashing names…' : 'Guess names from the staff list'}
          </Button>
          <Button
            variant="danger"
            onClick={() => target && void run('force', () => world.forceDecrypt(target.caseId), true)}
            disabled={busy !== null || !target}
            title={target ? `Targets ${target.caseId}` : 'There is no case to attack yet'}
          >
            <ShieldAlert aria-hidden />
            {busy === 'force' ? 'Asking the nodes…' : 'Attempt force decrypt / override'}
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p>}

      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-[12px] border border-rule lg:grid-cols-4">
        {[
          { label: 'Sealed reports stored', value: snapshot.rows.length, note: formatBytes(storedBytes) + ' of ciphertext' },
          { label: 'Readable with full access', value: 0, note: 'nothing here decrypts', strong: true },
          { label: 'Decryption keys on the server', value: 0, note: 'keys never reach it' },
          { label: 'Key shares on the server', value: 0, note: `all ${snapshot.nodeShares.reduce((a, n) => a + n.shares, 0)} held by ${snapshot.nodeShares.length} nodes` },
        ].map((kpi, i) => (
          <div key={kpi.label} className={cn('px-5 py-4', i % 2 === 1 && 'border-l border-rule', i >= 2 && 'border-t border-rule lg:border-t-0', i === 2 && 'lg:border-l')}>
            <dt className="text-[13px] font-medium">{kpi.label}</dt>
            <dd className={cn('tabular mt-1 text-[28px] leading-none', kpi.strong ? 'font-medium text-ink' : 'font-normal')}>{kpi.value}</dd>
            <dd className="mt-1.5 text-[13px] text-slate">{kpi.note}</dd>
          </div>
        ))}
      </dl>

      {snapshot.attacks.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2" aria-label="Admin attempts">
          {[...snapshot.attacks].reverse().slice(0, 3).map((a) => (
            <li key={a.seq} className="anim-fade-up flex flex-col gap-0.5 rounded-[10px] bg-panel px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="tabular shrink-0 text-[13px] text-slate">{formatTime(a.at)}</span>
              <span className="shrink-0 text-[14px] font-medium">{a.title}</span>
              <span className="text-[14px] text-slate">{a.outcome}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <UnderlineTabs label="Database tables" tabs={tabs} value={tab} onChange={setTab} />
      </div>

      {tab === 'reports' && (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-[13px] text-slate">
              {snapshot.rows.length} {snapshot.rows.length === 1 ? 'row' : 'rows'} in sealed_reports
            </span>
            <Button variant="outline" size="sm" onClick={exportDump} disabled={snapshot.rows.length === 0}>
              <Download aria-hidden />
              Export database
            </Button>
          </div>
          {snapshot.rows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[880px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12.5px] text-slate">
                    <th className="py-2 pr-4 font-normal">Report</th>
                    <th className="py-2 pr-4 font-normal">Case</th>
                    <th className="py-2 pr-4 font-normal">Sealed</th>
                    <th className="py-2 pr-4 font-normal">Delete after</th>
                    <th className="py-2 pr-4 font-normal">Content</th>
                    <th className="py-2 pr-4 text-right font-normal">Size</th>
                    <th className="py-2 font-normal">Blinded token (hashed)</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((row) => {
                    const total = row.ciphertextBytes + row.contactBytes + row.attachmentBytes.reduce((a, b) => a + b, 0)
                    return (
                      <tr key={row.id} className="h-14 border-t border-rule">
                        <td className="py-2 pr-4 font-mono text-[13px]">{row.id}</td>
                        <td className="py-2 pr-4 font-mono text-[13px] text-slate">{row.caseId}</td>
                        <td className="tabular py-2 pr-4 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                        <td className="tabular py-2 pr-4 whitespace-nowrap">{formatDate(row.expiresAt)}</td>
                        <td className="max-w-[280px] py-2 pr-4">
                          <span className="block truncate font-mono text-[13px]" title={`0x${row.ciphertextHex}`}>
                            0x{row.ciphertextHex.slice(0, 40)}…
                          </span>
                          {row.attachmentBytes.length > 0 && (
                            <span className="text-[12px] text-slate">+ {row.attachmentBytes.length} encrypted file{row.attachmentBytes.length === 1 ? '' : 's'}</span>
                          )}
                        </td>
                        <td className="tabular py-2 pr-4 text-right whitespace-nowrap">{formatBytes(total)}</td>
                        <td className="py-2 font-mono text-[13px]">{row.tokenDigest}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 max-w-[80ch] text-[13px] text-slate">
            Rows with the same token hash are about the same person; the server can see that, and nothing more. The
            token is keyed by the node network, so hashing a staff list never reproduces it.
          </p>
        </>
      )}

      {tab === 'stewards' && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-[14px]">
            <thead>
              <tr className="text-left text-[12.5px] text-slate">
                <th className="py-2 pr-4 font-normal">Seat</th>
                <th className="py-2 pr-4 font-normal">Key fingerprint</th>
                <th className="py-2 pr-4 font-normal">Added by</th>
                <th className="py-2 font-normal">Counted by the nodes</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.stewardTable.map((s) => (
                <tr key={s.id} className="h-12 border-t border-rule">
                  <td className="py-2 pr-4 font-medium">{s.seat}</td>
                  <td className="py-2 pr-4 font-mono text-[13px]">{s.fingerprint}</td>
                  <td className="py-2 pr-4">{s.addedBy === 'setup' ? 'Setup' : 'IT admin, just now'}</td>
                  <td className={cn('py-2', s.addedBy === 'setup' ? 'text-active-ink' : 'text-danger-ink')}>
                    {s.addedBy === 'setup' ? 'Yes, pinned at setup' : 'No, unknown to every node'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'requests' && (
        <div className="mt-6 overflow-x-auto">
          {snapshot.batches.length === 0 ? (
            <p className="py-10 text-[14px] text-slate">No key request has reached the nodes yet.</p>
          ) : (
            <table className="w-full min-w-[720px] text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-slate">
                  <th className="py-2 pr-4 font-normal">Time</th>
                  <th className="py-2 pr-4 font-normal">From</th>
                  <th className="py-2 pr-4 font-normal">Case</th>
                  <th className="py-2 pr-4 text-right font-normal">Nodes releasing</th>
                  <th className="py-2 font-normal">First node’s reason</th>
                </tr>
              </thead>
              <tbody>
                {[...snapshot.batches].reverse().map((b) => (
                  <tr key={b.seq} className="border-t border-rule align-top">
                    <td className="tabular py-3 pr-4 whitespace-nowrap">{formatTime(b.at)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{b.submittedBy}</td>
                    <td className="py-3 pr-4 font-mono text-[13px]">{b.caseId}</td>
                    <td className={cn('tabular py-3 pr-4 text-right', b.released ? 'text-active-ink' : 'text-danger-ink')}>
                      {b.verdicts.filter((v) => v.released).length} of {b.verdicts.length}
                    </td>
                    <td className="py-3 text-slate">{b.verdicts[0]?.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <DenyModal result={modal} snapshot={snapshot} onClose={() => setModal(null)} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mt-3 rounded-[12px] bg-panel px-6 py-10 text-center">
      <p className="text-[15px] font-medium">The database is empty.</p>
      <p className="mt-1 text-[14px] text-slate">
        Seal a report in the <Link href={ROUTES.report} className="font-medium text-ink underline underline-offset-2">reporter portal</Link>, then come back to see what an admin can read.
      </p>
    </div>
  )
}
