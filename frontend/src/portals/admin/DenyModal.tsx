import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { AttackResult, WorldSnapshot } from '@/escrow/simulation'

/**
 * The TideCloak security modal. Its contents are the real verdicts the five nodes returned for
 * the admin's request, not a canned message.
 */
export function DenyModal({
  result,
  snapshot,
  onClose,
}: {
  result: AttackResult | null
  snapshot: WorldSnapshot
  onClose: () => void
}) {
  const batch = result?.batch
  const released = batch?.released ?? false
  const seatName = (id: string) => snapshot.stewardTable.find((s) => s.id === id)?.seat ?? id
  const genuine = new Set(snapshot.approvals[batch?.caseId ?? ''] ?? [])

  // Identical verdicts are shown once; node reasons use seat ids, shown here by name.
  const reasonGroups: { reason: string; nodes: number[] }[] = []
  for (const v of batch?.verdicts ?? []) {
    const group = reasonGroups.find((g) => g.reason === v.reason)
    if (group) group.nodes.push(v.node)
    else reasonGroups.push({ reason: v.reason, nodes: [v.node] })
  }
  const readable = (part: string) => {
    let text = part.replace(/\.$/, '')
    for (const row of snapshot.stewardTable) text = text.replaceAll(`“${row.id}”`, row.seat)
    return text.charAt(0).toUpperCase() + text.slice(1) + '.'
  }

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[640px]"
        overlayClassName="bg-[#0f172a]/45 backdrop-blur-[6px]"
      >
        <div className={cn('px-6 pt-6 pb-5 text-white', released ? 'bg-vault' : 'bg-danger')}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
            {released ? <ShieldCheck className="size-4" aria-hidden /> : <ShieldAlert className="size-4" aria-hidden />}
            TideCloak security
          </div>
          <DialogTitle className="mt-3 text-[22px] leading-tight font-semibold">
            {released ? 'Released to the investigator, not to you' : 'ACCESS DENIED: Emergent Authority missing'}
          </DialogTitle>
          <DialogDescription className="mt-2 text-[15px] text-white/90">
            {released
              ? 'The stewards had already approved this case. The nodes deliver their shares only to the investigator.'
              : 'TideCloak Node Network rejected unauthorized key request.'}
          </DialogDescription>
        </div>

        {batch && (
          <div className="flex flex-col gap-5 px-6 py-5">
            <section>
              <h3 className="text-[14px] font-medium">What the admin sent for {batch.caseId}</h3>
              <ul className="mt-2 flex flex-col gap-1 text-[14px] text-slate">
                <li>Added an “IT admin” key to the server’s steward table and signed with it.</li>
                {batch.signers
                  .filter((id) => id !== 'it-admin')
                  .map((id) => (
                    <li key={id}>
                      {genuine.has(id) ? 'Attached the genuine approval of ' : 'Forged a signature for '}
                      {seatName(id)}.
                    </li>
                  ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[14px] font-medium">Each node decided on its own</h3>
              <ol className="mt-2 grid grid-cols-5 gap-1.5">
                {batch.verdicts.map((v) => (
                  <li
                    key={v.node}
                    className={cn('rounded-[8px] px-1 py-2 text-center sm:px-2', v.released ? 'bg-active-soft' : 'bg-danger-soft')}
                  >
                    <div className="tabular text-[12px] text-slate">Node {v.node}</div>
                    <div className={cn('text-[13px] font-medium', v.released ? 'text-active-ink' : 'text-danger-ink')}>
                      {v.released ? 'Released' : 'Refused'}
                    </div>
                  </li>
                ))}
              </ol>
              {reasonGroups.map((group) => (
                <div key={group.reason} className="mt-3">
                  <p className="text-[13px] text-slate">
                    {group.nodes.length === batch.verdicts.length
                      ? `All ${group.nodes.length} nodes gave the same reasons, each from its own records:`
                      : `Node ${group.nodes.join(', ')}:`}
                  </p>
                  <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-[14px]">
                    {group.reason.split('; ').map((part) => (
                      <li key={part}>{readable(part)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            <p className="text-[13px] text-slate">
              The nodes check signatures against the steward registry they were given at setup, so editing the
              server’s table changes nothing. This attempt is now in the public audit log.
            </p>
          </div>
        )}

        <div className="flex justify-end border-t border-rule px-6 py-4">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
