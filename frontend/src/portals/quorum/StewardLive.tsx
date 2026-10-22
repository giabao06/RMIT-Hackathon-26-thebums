/**
 * Steward view against the real API (/steward). Content-free by construction: the server only
 * returns case ids, counts and status. Approving a case means unwrapping your share of each report
 * on this device and re-wrapping it to the assigned investigator; the quorum is reached when enough
 * stewards have done so.
 */
import { useEffect, useState } from 'react'
import { Link } from '@/app/Link'
import { useAuth } from '@/app/auth'
import { ROUTES } from '@/app/router'
import { KeyGate } from '@/components/KeyGate'
import { Button } from '@/components/ui/button'
import type { StaffKey } from '@/escrow/keys'
import { rewrapForInvestigator } from '@/escrow/releaseCase'
import { formatDateTime } from '@/lib/format'

interface StewardCase {
  id: string
  status: 'eligible' | 'released'
  report_count: number
  eligible_at: string | null
  approvals: number
  quorum_m: number
  quorum_n: number
  mine: boolean
  assigned: boolean
}

export function StewardLive({ apiUrl }: { apiUrl: string }) {
  const { loading, session, secureFetch } = useAuth()
  if (loading) return <p className="text-[14px] text-slate">Loading…</p>
  if (!session) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-[22px] font-semibold">Steward quorum</h1>
        <p className="text-[14px] text-slate">Sign in with your steward account to see cases awaiting approval.</p>
        <Link href={ROUTES.signIn} className="text-[14px] font-medium underline underline-offset-2">Staff sign in</Link>
      </div>
    )
  }
  return (
    <KeyGate apiUrl={apiUrl} role="steward" userId={session.user.id} secureFetch={secureFetch}>
      {(key) => <Cases apiUrl={apiUrl} secureFetch={secureFetch} mine={key} />}
    </KeyGate>
  )
}

function Cases({ apiUrl, secureFetch, mine }: { apiUrl: string; secureFetch: (url: string, init?: RequestInit) => Promise<Response>; mine: StaffKey }) {
  const [cases, setCases] = useState<StewardCase[] | null>(null)
  const [holding, setHolding] = useState<Set<string>>(new Set()) // local only: a hold sends nothing
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // bump to reload

  useEffect(() => {
    secureFetch(`${apiUrl}/steward/cases`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Your account is not a steward.' : 'Could not load cases.')
        setCases((await res.json()) as StewardCase[])
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [apiUrl, secureFetch, tick])

  async function approve(id: string) {
    setBusy(id)
    setError(null)
    try {
      const got = await secureFetch(`${apiUrl}/steward/cases/${id}/shares`)
      if (!got.ok) throw new Error('Could not load your shares for this case.')
      const { stewardId, investigatorKey, shares } = (await got.json()) as {
        stewardId: string
        investigatorKey: string
        shares: { report: string; share: string }[]
      }
      const rewrapped = await rewrapForInvestigator(mine, stewardId, investigatorKey, shares)
      const res = await secureFetch(`${apiUrl}/steward/cases/${id}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shares: rewrapped }),
      })
      if (!res.ok) throw new Error(res.status === 409 ? 'This case is no longer awaiting approval.' : 'The approval was not recorded.')
      setTick((t) => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="steward-cases" className="flex flex-col">
      <h1 id="steward-cases" className="text-[22px] font-semibold">Steward quorum</h1>
      <p className="mt-1 max-w-[68ch] text-[14px] text-slate">
        You see case ids and counts only, never content. Approving releases your share to the assigned investigator on this device; a case opens when enough stewards approve. If one holds, the case waits.
      </p>
      {error && <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p>}
      {cases?.length === 0 && <p className="mt-6 text-[14px] text-slate">No case has reached the threshold.</p>}
      <ul className="mt-6 grid gap-3">
        {cases?.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-[12px] border border-rule bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-mono text-[14px]">{c.id}</div>
              <div className="tabular text-[13px] text-slate">
                {c.report_count} matching reports · {c.approvals} approvals, {c.quorum_m} open the case
                {c.eligible_at && ` · eligible ${formatDateTime(Date.parse(c.eligible_at))}`}
              </div>
            </div>
            {c.status === 'released' ? (
              <span className="text-[13px] font-medium text-active-ink">Quorum reached</span>
            ) : c.mine ? (
              <span className="text-[13px] font-medium text-active-ink">You approved · waiting for others</span>
            ) : !c.assigned ? (
              <span className="text-[13px] text-slate">Waiting for an admin to assign an investigator</span>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void approve(c.id)} disabled={busy !== null || holding.has(c.id)}>
                  {busy === c.id ? 'Releasing…' : 'Approve opening'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHolding((h) => new Set(h).add(c.id))} disabled={holding.has(c.id)}>
                  {holding.has(c.id) ? 'Holding' : 'Hold'}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
