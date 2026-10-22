import { Suspense, lazy, useState } from 'react'
import { useTideCloak } from '@tidecloak/react'
import { cn } from 'cn'
import { Link } from '@/app/Link'
import { ROUTES } from '@/app/router'
import { useTideConfigured } from '@/app/tideContext'
import { useWorld } from '@/app/worldContext'
import { ThresholdLock } from '@/components/ThresholdLock'
import { REPORT_THRESHOLD, STEWARD_QUORUM } from '@/escrow/simulation'
import { InvestigatorWorkspace } from './InvestigatorWorkspace'
import { NodeStrip } from './NodeStrip'
import { StewardSeats } from './StewardSeats'

const StewardLive = lazy(() => import('./StewardLive').then((m) => ({ default: m.StewardLive })))
const InvestigatorLive = lazy(() => import('./InvestigatorLive').then((m) => ({ default: m.InvestigatorLive })))
const API_URL = import.meta.env.VITE_API_URL as string | undefined

/** With a Tide realm and the API, stewards use the real backend; otherwise the simulation. */
export function QuorumPortal() {
  const tide = useTideConfigured()
  if (tide && API_URL) {
    return (
      <Suspense fallback={<p className="text-[14px] text-slate">Connecting to Tide…</p>}>
        <LiveQuorum apiUrl={API_URL} />
      </Suspense>
    )
  }
  return <SimulatedQuorum />
}

// UI routing only; the API checks the role on every request.
function LiveQuorum({ apiUrl }: { apiUrl: string }) {
  const { authenticated, hasRealmRole } = useTideCloak()
  return authenticated && hasRealmRole('investigator') && !hasRealmRole('steward') ? (
    <InvestigatorLive apiUrl={apiUrl} />
  ) : (
    <StewardLive apiUrl={apiUrl} />
  )
}

function SimulatedQuorum() {
  const { snapshot } = useWorld()
  const eligible = snapshot.cases.filter((c) => c.eligible)
  const waiting = snapshot.cases.filter((c) => !c.eligible)
  const [chosen, setChosen] = useState<string | null>(null)
  const current = eligible.find((c) => c.caseId === chosen) ?? eligible[0]

  if (!current) {
    return (
      <div className="flex flex-col">
        <h1 className="text-[22px] leading-tight font-semibold">Steward quorum & investigation</h1>
        <p className="mt-1 max-w-[68ch] text-[14px] text-slate">
          Stewards are only asked to act once two independent reports name the same person.
        </p>
        <div className="mt-8 rounded-[16px] bg-panel px-6 py-10">
          <ThresholdLock reports={Math.max(0, ...waiting.map((c) => c.independentReporters))} reportsNeeded={REPORT_THRESHOLD} />
          <p className="mt-5 text-[16px] font-medium">No case has reached the threshold.</p>
          <p className="mt-1 max-w-[62ch] text-[14px] text-slate">
            {waiting.length === 0
              ? 'Nothing has been reported yet. '
              : `${waiting.length === 1 ? 'One sealed report is' : `${waiting.length} sealed reports are`} waiting for a match, and nobody here can see who or what ${waiting.length === 1 ? 'it is' : 'they are'} about. `}
            To see a case open, file the two sample reports in the{' '}
            <Link href={ROUTES.report} className="font-medium text-ink underline underline-offset-2">reporter portal</Link>.
          </p>
        </div>
      </div>
    )
  }

  const opened = snapshot.opened[current.caseId]
  const approvals = new Set(snapshot.approvals[current.caseId] ?? [])
  const latestBatch = [...snapshot.batches].reverse().find((b) => b.caseId === current.caseId)

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] leading-tight font-semibold">
          <span className="text-slate">Cases / </span>
          {current.caseId}
        </h1>
        {eligible.length > 1 && (
          <label className="flex items-center gap-2 text-[13px] text-slate">
            Case
            <select
              value={current.caseId}
              onChange={(e) => setChosen(e.target.value)}
              className="h-8 rounded-[10px] border border-input bg-white px-2 font-mono text-[13px] text-ink"
            >
              {eligible.map((c) => (
                <option key={c.caseId} value={c.caseId}>
                  {c.caseId}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div
        role="status"
        className={cn(
          'anim-fade-up mt-5 flex flex-col gap-5 rounded-[16px] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between',
          opened ? 'bg-active-soft' : 'bg-vault text-vault-ink',
        )}
      >
        <div>
          <p className="text-[18px] font-semibold">
            {opened ? 'Case opened for the investigator' : `Threshold reached: ${current.independentReporters}/${REPORT_THRESHOLD} matching reports found`}
          </p>
          <p className={cn('mt-1 text-[14px]', opened ? 'text-ink' : 'text-vault-muted')}>
            Status:{' '}
            <span className={cn('font-medium', opened ? 'text-active-ink' : 'text-active')}>
              {opened ? 'Released by quorum' : 'Pending quorum approval'}
            </span>
            {!opened && ` · ${STEWARD_QUORUM} of 3 stewards must approve`}
          </p>
        </div>
        <ThresholdLock
          tone={opened ? 'light' : 'vault'}
          reports={current.independentReporters}
          reportsNeeded={REPORT_THRESHOLD}
          quorum={STEWARD_QUORUM}
          seats={snapshot.stewards.map((s) => ({ ...s, approved: approvals.has(s.id) }))}
        />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <StewardSeats caseId={current.caseId} released={Boolean(opened)} />
        <NodeStrip batch={latestBatch} nodes={snapshot.nodeShares.map((n) => n.node)} />
      </div>

      <div className="mt-10">
        <InvestigatorWorkspace key={current.caseId} reports={opened} />
      </div>
    </div>
  )
}
