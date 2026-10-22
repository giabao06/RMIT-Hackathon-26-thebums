import { Fingerprint } from 'lucide-react'
import { Field, SettingsRow } from '@/components/SettingsRow'
import { Input } from '@/components/ui/input'
import { normaliseIdentifier, normaliseName, normaliseUnit } from '@/escrow/subject'
import type { Draft } from './draft'

export function StepTarget({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const s = draft.subject
  const set = (patch: Partial<Draft['subject']>) => update({ subject: { ...s, ...patch } })
  const id = normaliseIdentifier(s.identifier)
  const name = normaliseName(s.name)
  const unit = normaliseUnit(s.unit)

  return (
    <SettingsRow
      title="Who is this about?"
      description="The person you are reporting. These three details are only used to find other reports about the same person."
      aside={
        <div className="rounded-[12px] bg-active-soft p-4">
          <div className="flex items-start gap-3">
            <Fingerprint className="mt-0.5 size-5 shrink-0 text-active-ink" strokeWidth={1.75} aria-hidden />
            <p className="text-[14px] leading-snug">
              A unique, irreversible <strong className="font-semibold">blinded token</strong> is created from these
              details. The target’s identity is never exposed: not to the server, the admin or other reporters.
            </p>
          </div>
          <div className="mt-3 border-t border-[#cfeee0] pt-3 text-[13px]">
            <div className="text-slate">Normalised on this device as</div>
            <div className="mt-0.5 font-mono text-[12.5px] break-words text-ink">
              {id || name || unit ? [id || '—', name || '—', unit || '—'].join(' · ') : '—'}
            </div>
            <div className="mt-1.5 text-slate">
              Spelling, titles, word order and accents are ignored, so “Dr Varga, Ellis” and “Ellis Varga” match.
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="target-name">
          <Input id="target-name" autoComplete="off" value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder="As students or staff would know them" className="h-10 bg-white" />
        </Field>
        <Field
          label="Staff or student number, or university email"
          htmlFor="target-id"
          hint="Use the number if you know it. Two reports only match when they use the same kind of identifier."
        >
          <Input id="target-id" autoComplete="off" value={s.identifier} onChange={(e) => set({ identifier: e.target.value })} className="h-10 bg-white" />
        </Field>
        <Field label="School or department" htmlFor="target-unit">
          <Input id="target-unit" autoComplete="off" value={s.unit} onChange={(e) => set({ unit: e.target.value })} className="h-10 bg-white" />
        </Field>
      </div>
    </SettingsRow>
  )
}
