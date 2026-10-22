/**
 * Investigator view against the real API (/investigator). The server returns only ciphertext and the
 * stewards' re-wrapped shares of released cases assigned to this investigator; the key is rebuilt and
 * the reports opened on this device.
 */
import { useEffect, useState } from 'react'
import { Link } from '@/app/Link'
import { useAuth } from '@/app/auth'
import { ROUTES } from '@/app/router'
import { KeyGate } from '@/components/KeyGate'
import type { StaffKey } from '@/escrow/keys'
import { openReports } from '@/escrow/releaseCase'
import type { OpenedReport } from '@/escrow/types'
import { formatDateTime } from '@/lib/format'
import { InvestigatorWorkspace } from './InvestigatorWorkspace'

interface AssignedCase {
  id: string
  report_count: number
  eligible_at: string | null
}

export function InvestigatorLive({ apiUrl }: { apiUrl: string }) {
  const { loading, session, secureFetch } = useAuth()
  if (loading) return <p className="text-[14px] text-slate">Loading…</p>
  if (!session) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-[22px] font-semibold">Investigation</h1>
        <p className="text-[14px] text-slate">Sign in with your investigator account to see the cases assigned to you.</p>
        <Link href={ROUTES.signIn} className="text-[14px] font-medium underline underline-offset-2">Staff sign in</Link>
      </div>
    )
  }
  return (
    <KeyGate apiUrl={apiUrl} role="investigator" userId={session.user.id} secureFetch={secureFetch}>
      {(key) => <Cases apiUrl={apiUrl} secureFetch={secureFetch} mine={key} />}
    </KeyGate>
  )
}

function Cases({ apiUrl, secureFetch, mine }: { apiUrl: string; secureFetch: (url: string, init?: RequestInit) => Promise<Response>; mine: StaffKey }) {
  const [cases, setCases] = useState<AssignedCase[] | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [reports, setReports] = useState<OpenedReport[] | undefined>()
  const [error, setError] = useState<string | null>(null)
  const current = cases?.find((c) => c.id === chosen) ?? cases?.[0]

  useEffect(() => {
    secureFetch(`${apiUrl}/investigator/cases`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Your account is not an investigator.' : 'Could not load cases.')
        setCases((await res.json()) as AssignedCase[])
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [apiUrl, secureFetch])

  const caseId = current?.id
  useEffect(() => {
    if (!caseId) return
    let cancelled = false
    Promise.all([secureFetch(`${apiUrl}/investigator/cases/${caseId}/reports`), secureFetch(`${apiUrl}/investigator/cases/${caseId}/shares`)])
      .then(async ([r, s]) => {
        if (!r.ok || !s.ok) throw new Error('Could not load the reports for this case.')
        const rows = (await r.json()) as { id: string; sealedAt: string; ciphertext: string; contact: string | null }[]
        const shares = (await s.json()) as { reportId: string; share: string }[]
        return openReports(mine, rows, shares)
      })
      .then((opened) => !cancelled && setReports(opened.sort((a, b) => a.sealedAt - b.sealedAt)))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [caseId, apiUrl, secureFetch, mine])

  return (
    <section aria-labelledby="investigator-cases" className="flex flex-col">
      <h1 id="investigator-cases" className="text-[22px] font-semibold">Investigation</h1>
      <p className="mt-1 max-w-[68ch] text-[14px] text-slate">
        You see only cases released to you. The server holds ciphertext; the reports open on this device.
      </p>
      {error && <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p>}
      {cases?.length === 0 && <p className="mt-6 text-[14px] text-slate">No released case is assigned to you yet.</p>}
      {current && (
        <>
          <label className="mt-4 flex items-center gap-2 text-[13px] text-slate">
            Case
            <select
              value={current.id}
              onChange={(e) => {
                setReports(undefined)
                setChosen(e.target.value)
              }}
              className="h-8 rounded-[10px] border border-input bg-white px-2 font-mono text-[13px] text-ink"
            >
              {cases?.map((c) => (
                <option key={c.id} value={c.id}>{c.id}</option>
              ))}
            </select>
            <span className="tabular">
              {current.report_count} reports{current.eligible_at && ` · eligible ${formatDateTime(Date.parse(current.eligible_at))}`}
            </span>
          </label>
          <div className="mt-6">
            <InvestigatorWorkspace key={current.id} reports={reports} />
          </div>
        </>
      )}
    </section>
  )
}
