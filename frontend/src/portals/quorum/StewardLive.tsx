/**
 * Steward view against the real API (/steward). Content-free by construction: the server only
 * returns case ids, counts and status. Loaded only when a Tide realm and the API are configured.
 */
import { useEffect, useState } from 'react'
import { useTideCloak } from '@tidecloak/react'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'

interface StewardCase {
  id: string
  status: 'eligible' | 'approved'
  report_count: number
  eligible_at: string | null
  approvals: number
  quorum_m: number
  quorum_n: number
  mine: boolean
}

export function StewardLive({ apiUrl }: { apiUrl: string }) {
  const { isInitializing, authenticated, login, hasRealmRole, secureFetch } = useTideCloak()
  const [cases, setCases] = useState<StewardCase[] | null>(null)
  const [holding, setHolding] = useState<Set<string>>(new Set()) // local only: a hold sends nothing
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isSteward = authenticated && hasRealmRole('steward')

  const [tick, setTick] = useState(0) // bump to reload

  useEffect(() => {
    if (!isSteward) return
    secureFetch(`${apiUrl}/steward/cases`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Your account is not a steward.' : 'Could not load cases.')
        setCases((await res.json()) as StewardCase[])
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [isSteward, apiUrl, secureFetch, tick])

  async function approve(id: string) {
    setBusy(id)
    try {
      // The Tide-signed attestation replaces this once the release policy is deployed.
      const res = await secureFetch(`${apiUrl}/steward/cases/${id}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signature: `session:${new Date().toISOString()}` }),
      })
      if (!res.ok) throw new Error(res.status === 409 ? 'This case is no longer awaiting approval.' : 'The approval was not recorded.')
      setTick((t) => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (isInitializing) return <p className="text-[14px] text-slate">Connecting to Tide…</p>
  if (!authenticated) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-[22px] font-semibold">Steward quorum</h1>
        <p className="text-[14px] text-slate">Sign in with your steward account to see cases awaiting approval.</p>
        <Button onClick={() => void login()}>Sign in with Tide</Button>
      </div>
    )
  }
  if (!isSteward) {
    return <p role="alert" className="text-[14px] text-danger-ink">This account has no steward role. Ask the realm admin to grant it.</p>
  }

  return (
    <section aria-labelledby="steward-cases" className="flex flex-col">
      <h1 id="steward-cases" className="text-[22px] font-semibold">Steward quorum</h1>
      <p className="mt-1 max-w-[68ch] text-[14px] text-slate">
        You see case ids and counts only, never content. A case opens when enough stewards approve; if one holds, the case waits.
      </p>
      {error && <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p>}
      {cases?.length === 0 && <p className="mt-6 text-[14px] text-slate">No case has reached the threshold.</p>}
      <ul className="mt-6 grid gap-3">
        {cases?.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-[12px] border border-rule bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-mono text-[14px]">{c.id}</div>
              <div className="tabular text-[13px] text-slate">
                {c.report_count} matching reports · {c.approvals}/{c.quorum_n} approvals, {c.quorum_m} open the case
                {c.eligible_at && ` · eligible ${formatDateTime(Date.parse(c.eligible_at))}`}
              </div>
            </div>
            {c.status === 'approved' ? (
              <span className="text-[13px] font-medium text-active-ink">Quorum reached</span>
            ) : c.mine ? (
              <span className="text-[13px] font-medium text-active-ink">You approved · waiting for others</span>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void approve(c.id)} disabled={busy !== null || holding.has(c.id)}>
                  {busy === c.id ? 'Recording…' : 'Approve opening'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHolding((h) => new Set(h).add(c.id))}
                  disabled={holding.has(c.id)}
                >
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
