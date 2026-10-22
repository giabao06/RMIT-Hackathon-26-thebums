import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { cn } from 'cn'
import { Field, SettingsRow } from '@/components/SettingsRow'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LIFESPAN_OPTIONS, MIN_PASSPHRASE_LENGTH } from '@/escrow/types'
import { formatDate } from '@/lib/format'
import { generatePassphrase, type Draft } from './draft'

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

export function StepEscrow({ draft, update, now }: { draft: Draft; update: (patch: Partial<Draft>) => void; now: number }) {
  const [show, setShow] = useState(false)
  const mismatch = draft.confirm.length > 0 && draft.confirm !== draft.passphrase

  return (
    <SettingsRow
      title="Escrow settings"
      description="How long your report waits for a match, and the passphrase that lets you take it back."
      aside={
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
          <dt className="text-slate">Encryption</dt>
          <dd>AES-256-GCM, on this device</dd>
          <dt className="text-slate">Key</dt>
          <dd>Split across the stewards; no one holds it whole</dd>
          <dt className="text-slate">Opens when</dt>
          <dd>2 independent reports match and 2 of 3 stewards approve</dd>
          <dt className="text-slate">Deleted on</dt>
          <dd className="tabular">{formatDate(now + draft.lifespanMonths * MONTH_MS)} if nobody else reports</dd>
        </dl>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[14px] font-medium">Report lifespan</legend>
          <div className="grid grid-cols-3 gap-2">
            {LIFESPAN_OPTIONS.map((months) => {
              const checked = draft.lifespanMonths === months
              return (
                <label
                  key={months}
                  className={cn(
                    'flex cursor-pointer flex-col rounded-[10px] border bg-white px-3 py-2.5 transition-colors',
                    checked ? 'border-ink ring-1 ring-ink' : 'border-input hover:border-[#94a3b8]',
                  )}
                >
                  <input
                    type="radio"
                    name="lifespan"
                    value={months}
                    checked={checked}
                    onChange={() => update({ lifespanMonths: months })}
                    className="sr-only"
                  />
                  <span className="tabular text-[15px] font-medium">{months} months</span>
                  <span className="tabular text-[12px] text-slate">until {formatDate(now + months * MONTH_MS)}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <Field
          label="Withdrawal passphrase"
          htmlFor="passphrase"
          hint={`At least ${MIN_PASSPHRASE_LENGTH} characters. Only a slow hash of it is stored. Nobody can reset it for you.`}
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="passphrase"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={draft.passphrase}
                onChange={(e) => update({ passphrase: e.target.value })}
                className="h-10 bg-white pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Hide passphrase' : 'Show passphrase'}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate hover:text-ink"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const generated = generatePassphrase()
                update({ passphrase: generated, confirm: generated })
                setShow(true)
              }}
              className="flex h-10 items-center gap-1.5 rounded-[10px] bg-secondary px-3 text-[14px] font-medium hover:bg-[#dde4ec]"
            >
              <KeyRound className="size-4" aria-hidden />
              Generate
            </button>
          </div>
        </Field>

        <Field label="Repeat the passphrase" htmlFor="passphrase-confirm">
          <Input
            id="passphrase-confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={draft.confirm}
            onChange={(e) => update({ confirm: e.target.value })}
            aria-invalid={mismatch || undefined}
            className="h-10 bg-white font-mono"
          />
          {mismatch && <span className="text-[13px] text-danger-ink">The two passphrases differ.</span>}
        </Field>

        <Field
          label="How to reach you (optional)"
          htmlFor="contact"
          hint="Sealed separately and only read if the case opens. Leave it blank to stay fully anonymous; you can delete it later even after a match."
        >
          <Textarea
            id="contact"
            rows={2}
            value={draft.contact}
            onChange={(e) => update({ contact: e.target.value })}
            className="bg-white"
          />
        </Field>
      </div>
    </SettingsRow>
  )
}
