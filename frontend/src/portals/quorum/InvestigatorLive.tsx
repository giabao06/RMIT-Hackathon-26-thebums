/**
 * Investigator view against the real API (/investigator). The server returns only ciphertext of
 * released reports for cases assigned to this investigator; decryption happens on this device.
 */
import { useEffect, useState } from 'react'
import { useTideCloak } from '@tidecloak/react'
import { Button } from '@/components/ui/button'
import { decryptReport } from '@/escrow/tideDecrypt'
import type { OpenedReport } from '@/escrow/simulation'
import { formatDateTime } from '@/lib/format'
import { InvestigatorWorkspace } from './InvestigatorWorkspace'

interface AssignedCase {
  id: string
  report_count: number
  eligible_at: string | null
}

interface SealedRow {
  id: string
  sealedAt: string
  ciphertext: string
  contact?: string | null
}

export function InvestigatorLive({ apiUrl }: { apiUrl: string }) {
  const { isInitializing, authenticated, login, hasRealmRole, secureFetch } = useTideCloak()
  const [cases, setCases] = useState<AssignedCase[] | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [reports, setReports] = useState<OpenedReport[] | undefined>()
  const [error, setError] = useState<string | null>(null)
  const isInvestigator = authenticated && hasRealmRole('investigator')
  const current = cases?.find((c) => c.id === chosen) ?? cases?.[0]

  useEffect(() => {
    if (!isInvestigator) return
    secureFetch(`${apiUrl}/investigator/cases`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Your account is not an investigator.' : 'Could not load cases.')
        setCases((await res.json()) as AssignedCase[])
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [isInvestigator, apiUrl, secureFetch])

  const caseId = current?.id
  useEffect(() => {
    if (!caseId) return
    let cancelled = false
    secureFetch(`${apiUrl}/investigator/cases/${caseId}/reports`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load the reports for this case.')
        const rows = (await res.json()) as SealedRow[]
        return Promise.all(rows.map(decryptReport))
      })
      .then((opened) => !cancelled && setReports(opened))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [caseId, apiUrl, secureFetch])

  if (isInitializing) return <p className="text-[14px] text-slate">Connecting to Tide…</p>
  if (!authenticated) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-[22px] font-semibold">Investigation</h1>
        <p className="text-[14px] text-slate">Sign in with your investigator account to see the cases assigned to you.</p>
        <Button onClick={() => void login()}>Sign in with Tide</Button>
      </div>
    )
  }
  if (!isInvestigator) {
    return <p role="alert" className="text-[14px] text-danger-ink">This account has no investigator role. Ask the realm admin to grant it.</p>
  }

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
              onChange={(e) => setChosen(e.target.value)}
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
