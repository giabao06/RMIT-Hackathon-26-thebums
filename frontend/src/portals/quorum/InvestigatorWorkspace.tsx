import { useState } from 'react'
import { Lock } from 'lucide-react'
import { type OpenedReport } from '@/escrow/types'
import { daysBetweenIso, formatDuration, formatIsoDate, plural } from '@/lib/format'
import { ReportColumn } from './ReportColumn'

export function InvestigatorWorkspace({ reports }: { reports: OpenedReport[] | undefined }) {
  // Animate the doors only when the case opens while this view is on screen.
  const [wasLocked] = useState(!reports)
  const animate = wasLocked && reports !== undefined

  return (
    <section aria-labelledby="investigator-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="investigator-heading" className="text-[16px] font-semibold">Investigation workspace</h2>
        <span className="text-[13px] text-slate">For the independent investigator only</span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-[16px]">
        {reports ? <Opened reports={reports} /> : <Locked />}
        {animate && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex">
            <div className="anim-door-left h-full w-1/2 bg-vault" />
            <div className="anim-door-right h-full w-1/2 bg-vault" />
          </div>
        )}
      </div>
    </section>
  )
}

function Locked() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 bg-vault px-6 py-12 text-center text-vault-ink">
      <span className="grid size-12 place-items-center rounded-full bg-vault-raised">
        <Lock className="size-5 text-vault-muted" aria-hidden />
      </span>
      <p className="text-[16px] font-medium">The escrow box is sealed.</p>
      <p className="max-w-[52ch] text-[14px] text-vault-muted">
        It opens here, for the investigator, once the steward quorum approves. Until then no one holds a key that can open it.
      </p>
    </div>
  )
}

function Opened({ reports }: { reports: OpenedReport[] }) {
  const [first, second] = reports
  const incidentGap = first && second ? daysBetweenIso(first.incidentDate, second.incidentDate) : null
  const sealedGap = first && second ? second.sealedAt - first.sealedAt : null

  return (
    <div className="bg-panel p-3 sm:p-4">
      <div className="grid gap-x-8 gap-y-3 rounded-[12px] bg-white px-5 py-4 text-[14px] sm:grid-cols-2">
        <div>
          <div className="text-[13px] text-slate">Incidents</div>
          <div className="tabular mt-0.5 font-medium">
            {incidentGap === null ? '—' : `${plural(incidentGap, 'day')} apart`}
          </div>
          {first && second && (
            <div className="tabular text-[13px] text-slate">
              {formatIsoDate(first.incidentDate)} and {formatIsoDate(second.incidentDate)}
            </div>
          )}
        </div>
        <div>
          <div className="text-[13px] text-slate">Reports sealed</div>
          <div className="tabular mt-0.5 font-medium">{sealedGap === null ? '—' : `${formatDuration(sealedGap)} apart`}</div>
          <div className="text-[13px] text-slate">by two independent, anonymous reporters</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {reports.map((report, i) => (
          <ReportColumn key={report.reportId} report={report} label={i === 0 ? 'First report' : i === 1 ? 'Second report' : `Report ${report.reportId}`} />
        ))}
      </div>
      <p className="mt-3 px-1 text-[13px] text-slate">
        Before acting, check that both reports describe the same person: the match was made on a keyed token from the
        name, identifier and department, without anyone reading them.
      </p>
    </div>
  )
}
