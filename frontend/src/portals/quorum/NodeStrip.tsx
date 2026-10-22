import { cn } from 'cn'
import type { VerdictBatch } from '@/escrow/simulation'

/** The five nodes and what each said to the latest key request for this case. */
export function NodeStrip({ batch, nodes }: { batch: VerdictBatch | undefined; nodes: number[] }) {
  return (
    <section aria-labelledby="nodes-heading">
      <h2 id="nodes-heading" className="text-[16px] font-semibold">Tide node network</h2>
      <p className="mt-1 text-[13px] text-slate">
        {batch
          ? `Latest key request, from ${batch.submittedBy.toLowerCase()}. Any 3 releasing nodes rebuild the key.`
          : 'No key request yet. Each node checks the reports and the signatures itself.'}
      </p>
      <ol className="mt-3 grid grid-cols-5 gap-2">
        {nodes.map((node) => {
          const verdict = batch?.verdicts.find((v) => v.node === node)
          const hostile = batch?.submittedBy === 'IT admin'
          const state = !verdict ? 'idle' : verdict.released ? 'released' : hostile ? 'refused' : 'waiting'
          return (
            <li
              key={node}
              title={verdict?.reason}
              className={cn(
                'rounded-[10px] px-1 py-2.5 text-center transition-colors duration-500 sm:px-2',
                { idle: 'bg-panel', released: 'bg-active-soft', refused: 'bg-danger-soft', waiting: 'bg-pending-soft' }[state],
              )}
            >
              <div className="tabular text-[12px] text-slate">Node {node}</div>
              <div
                className={cn(
                  'mt-0.5 text-[13px] font-medium',
                  { idle: 'text-slate', released: 'text-active-ink', refused: 'text-danger-ink', waiting: 'text-pending-ink' }[state],
                )}
              >
                {{ idle: 'Idle', released: 'Released', refused: 'Refused', waiting: 'Waiting' }[state]}
              </div>
            </li>
          )
        })}
      </ol>
      {batch && !batch.released && <p className="mt-2 text-[13px] text-slate">{batch.verdicts[0]?.reason}</p>}
    </section>
  )
}
