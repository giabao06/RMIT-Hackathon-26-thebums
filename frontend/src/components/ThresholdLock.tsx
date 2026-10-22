import { cn } from 'cn'
import type { StewardId, StewardStance } from '@/escrow/simulation'
import { SEAT_STYLE } from './seatStyle'

/**
 * The product's signature element: what a case is waiting for, drawn as a lock with two report
 * slots and three steward seals. It appears wherever a case's state is shown.
 */


interface Props {
  reports: number
  reportsNeeded: number
  seats?: { id: StewardId; seat: string; stance: StewardStance; approved: boolean }[]
  quorum?: number
  tone?: 'light' | 'vault'
  animate?: boolean
  className?: string
}

export function ThresholdLock({ reports, reportsNeeded, seats, quorum, tone = 'light', animate, className }: Props) {
  const vault = tone === 'vault'
  const approved = seats?.filter((s) => s.approved).length ?? 0
  return (
    <div className={cn('flex flex-wrap items-center gap-x-8 gap-y-4', className)}>
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5" role="img" aria-label={`${Math.min(reports, reportsNeeded)} of ${reportsNeeded} matching reports`}>
          {Array.from({ length: reportsNeeded }, (_, i) => (
            <ReportSlot key={i} filled={i < reports} vault={vault} animate={animate && i === reports - 1} />
          ))}
        </div>
        <div className="leading-tight">
          <div className={cn('tabular text-[15px] font-medium', vault ? 'text-vault-ink' : 'text-ink')}>
            {Math.min(reports, reportsNeeded)}/{reportsNeeded}
          </div>
          <div className={cn('text-[12px]', vault ? 'text-vault-muted' : 'text-slate')}>matching reports</div>
        </div>
      </div>

      {seats && quorum !== undefined && (
        <div className="flex items-center gap-3">
          <div className="flex gap-1" role="img" aria-label={`${approved} of ${seats.length} stewards approved, ${quorum} needed`}>
            {seats.map((s) => (
              <Seal key={s.id} id={s.id} seat={s.seat} approved={s.approved} holding={s.stance === 'holding'} />
            ))}
          </div>
          <div className="leading-tight">
            <div className={cn('tabular text-[15px] font-medium', vault ? 'text-vault-ink' : 'text-ink')}>
              {approved}/{seats.length}
            </div>
            <div className={cn('text-[12px]', vault ? 'text-vault-muted' : 'text-slate')}>approvals · {quorum} open it</div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportSlot({ filled, vault, animate }: { filled: boolean; vault: boolean; animate?: boolean }) {
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" aria-hidden className={cn(animate && 'anim-seal-drop')}>
      {filled ? (
        <>
          <rect x="0.75" y="0.75" width="24.5" height="32.5" rx="5" fill="#10B981" />
          <circle cx="13" cy="14" r="3.6" fill={vault ? '#0F172A' : '#ffffff'} />
          <path d="M11.4 16.5h3.2l0.9 7h-5z" fill={vault ? '#0F172A' : '#ffffff'} />
        </>
      ) : (
        <rect
          x="1"
          y="1"
          width="24"
          height="32"
          rx="5"
          fill="none"
          stroke={vault ? '#475569' : '#94a3b8'}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  )
}

function Seal({ id, seat, approved, holding }: { id: StewardId; seat: string; approved: boolean; holding: boolean }) {
  const style = SEAT_STYLE[id]
  return (
    <span
      title={`${seat}: ${approved ? 'approved' : holding ? 'holding' : 'not yet'}`}
      className={cn(
        'relative grid size-9 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-300',
        approved ? 'bg-active text-ink' : cn(style.tint, 'text-ink'),
        !approved && holding && 'outline-2 outline-dashed outline-offset-1 outline-pending-ink',
      )}
    >
      {style.initials}
    </span>
  )
}
