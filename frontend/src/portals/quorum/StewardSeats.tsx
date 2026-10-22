import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { useWorld } from '@/app/worldContext'
import { SEAT_STYLE } from '@/components/seatStyle'
import { Button } from '@/components/ui/button'
import { STEWARD_QUORUM, type StewardId } from '@/escrow/simulation'

const ROLE: Record<StewardId, string> = {
  'student-union': 'Elected by students',
  'independent-ngo': 'Outside the university',
  inspectorate: 'Statutory oversight',
}

export function StewardSeats({ caseId, released }: { caseId: string; released: boolean }) {
  const { world, snapshot } = useWorld()
  const [busy, setBusy] = useState<StewardId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const approved = new Set(snapshot.approvals[caseId] ?? [])
  const count = snapshot.stewards.filter((s) => approved.has(s.id)).length

  async function approve(id: StewardId) {
    setBusy(id)
    setError(null)
    try {
      await world.approve(id, caseId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="stewards-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="stewards-heading" className="text-[16px] font-semibold">Steward approvals</h2>
        <p className="tabular text-[14px]">
          <span className="font-semibold">{count}/{snapshot.stewards.length}</span>
          <span className="text-slate"> approvals received · {STEWARD_QUORUM} open the case</span>
        </p>
      </div>

      <div className="mt-3 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={snapshot.stewards.length} aria-valuenow={count} aria-label="Approvals received">
        {snapshot.stewards.map((s, i) => (
          <span
            key={s.id}
            className={cn('h-1.5 flex-1 rounded-full transition-colors duration-500', i < count ? 'bg-active' : 'bg-[#e2e8f0]')}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {snapshot.stewards.map((s) => {
          const isApproved = approved.has(s.id)
          const holding = !isApproved && s.stance === 'holding'
          return (
            <div key={s.id} className={cn('flex flex-col rounded-[12px] border p-4 transition-colors', isApproved ? 'border-[#bfe8d6] bg-active-soft' : 'border-rule bg-white')}>
              <div className="flex items-center gap-3">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-[12px] font-semibold', isApproved ? 'bg-active' : SEAT_STYLE[s.id].tint)}>
                  {isApproved ? <Check className="size-5" strokeWidth={2.5} aria-hidden /> : SEAT_STYLE[s.id].initials}
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">{s.seat}</div>
                  <div className="text-[13px] text-slate">{ROLE[s.id]}</div>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                <dt className="text-slate">Key</dt>
                <dd className="truncate font-mono">{s.fingerprint}</dd>
                <dt className="text-slate">Decision</dt>
                <dd className={cn(isApproved ? 'font-medium text-active-ink' : holding ? 'text-pending-ink' : 'text-ink')}>
                  {isApproved ? 'Approved, signed' : holding ? 'Holding, not signed' : 'Not yet'}
                </dd>
              </dl>
              {!isApproved && !released && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="h-8 flex-1" onClick={() => void approve(s.id)} disabled={busy !== null}>
                    {busy === s.id ? 'Signing…' : 'Approve opening'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => world.hold(s.id)} disabled={busy !== null || holding}>
                    Hold
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[13px] text-slate">
        Stewards sign the case and report IDs only. They never see the content, before or after.
        {snapshot.stewards.some((s) => s.stance === 'holding' && !approved.has(s.id)) &&
          ' A steward is holding: the case waits for a quorum, and nobody can sign in their place.'}
      </p>
      {error && <p role="alert" className="mt-2 text-[14px] text-danger-ink">{error}</p>}
    </section>
  )
}
