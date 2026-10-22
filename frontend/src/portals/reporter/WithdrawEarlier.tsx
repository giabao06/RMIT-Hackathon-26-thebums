import { useState, type FormEvent } from 'react'
import { Field, SettingsRow } from '@/components/SettingsRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { withdrawReport } from '@/escrow/reportsApi'

const RESULT = {
  deleted: 'Destroyed. The ciphertext and its matching token are deleted.',
  contact: 'This report is part of a matched case, so only your contact details were deleted.',
}

export function WithdrawEarlier() {
  const [reportId, setReportId] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ tone: 'ok', text: RESULT[await withdrawReport(reportId.trim().toLowerCase(), passphrase)] })
      setPassphrase('')
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsRow
      title="Withdraw an earlier report"
      description="Before a match you can destroy a report completely. After a match only your contact details can be removed, so the other reporter is not left alone."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Report ID" htmlFor="withdraw-id">
            <Input id="withdraw-id" value={reportId} onChange={(e) => setReportId(e.target.value)} autoComplete="off" className="h-10 bg-white font-mono" />
          </Field>
          <Field label="Passphrase" htmlFor="withdraw-pass">
            <Input id="withdraw-pass" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" className="h-10 bg-white font-mono" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" disabled={busy || !reportId || !passphrase}>
            {busy ? 'Checking…' : 'Withdraw'}
          </Button>
          {message && (
            <p role="status" className={message.tone === 'ok' ? 'text-[14px] text-active-ink' : 'text-[14px] text-danger-ink'}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </SettingsRow>
  )
}
