import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { reportStatus, withdrawReport } from '@/escrow/reportsApi'
import { ThresholdLock } from '@/components/ThresholdLock'
import { Button } from '@/components/ui/button'
import { REPORT_THRESHOLD, formatBytes, type Receipt } from '@/escrow/types'
import { formatDate, formatDateTime } from '@/lib/format'

type VaultState = 'waiting' | 'matched' | 'withdrawn' | 'contact-removed' | 'gone'

const HEADLINE: Record<VaultState, { pill: string; title: string; body: string }> = {
  waiting: {
    pill: 'Sealed · waiting for match (1/2)',
    title: 'Your report is safely sealed.',
    body: 'It will not be revealed unless another independent person files a matching report about the same individual. Until then nobody can open it, including us.',
  },
  matched: {
    pill: 'Threshold reached (2/2) · pending quorum',
    title: 'Someone else reported the same person.',
    body: 'Both reports are still sealed. They open only when the stewards approve, and then only for the independent investigator.',
  },
  withdrawn: {
    pill: 'Destroyed',
    title: 'Your report no longer exists.',
    body: `The ciphertext and its blinded token were deleted. Nothing about it can be recovered or matched.`,
  },
  'contact-removed': {
    pill: 'Matched · contact details removed',
    title: 'Your contact details were deleted.',
    body: 'This report is part of a matched case, so the report itself can no longer be withdrawn. Your optional contact details are gone.',
  },
  gone: {
    pill: 'No longer stored',
    title: 'This report no longer exists.',
    body: 'It was withdrawn, or reached the end of its lifespan without a match and was permanently deleted.',
  },
}

export function SealedVault({ receipt, passphrase, onNew }: { receipt: Receipt; passphrase: string; onNew: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<VaultState>('waiting')

  const refresh = useCallback(() => {
    return reportStatus(receipt.reportId, passphrase)
      .then((status) =>
        setState((s) => (s === 'withdrawn' || s === 'contact-removed' ? s : status === 'gone' ? 'gone' : status === 'eligible' ? 'matched' : 'waiting')),
      )
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [receipt.reportId, passphrase])

  useEffect(() => {
    let cancelled = false
    void reportStatus(receipt.reportId, passphrase)
      .then((status) => !cancelled && setState(status === 'gone' ? 'gone' : status === 'eligible' ? 'matched' : 'waiting'))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [receipt.reportId, passphrase])

  const gone = state === 'withdrawn' || state === 'gone'
  const copy = HEADLINE[state]

  async function destroy() {
    setBusy(true)
    setError(null)
    try {
      setState((await withdrawReport(receipt.reportId, passphrase)) === 'deleted' ? 'withdrawn' : 'contact-removed')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1152px]">
      <div className="anim-fade-up overflow-hidden rounded-[16px] bg-vault text-vault-ink">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 lg:p-10">
          <VaultGraphic state={state} />

          <div className="min-w-0">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium',
                gone ? 'bg-vault-raised text-vault-muted' : 'bg-active/15 text-active',
              )}
            >
              <span className={cn('size-1.5 rounded-full', gone ? 'bg-vault-muted' : 'bg-active')} aria-hidden />
              {copy.pill}
            </span>
            <h1 className="mt-4 text-[26px] leading-tight font-semibold sm:text-[30px]">{copy.title}</h1>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-vault-muted">{copy.body}</p>

            {!gone && (
              <ThresholdLock
                className="mt-6"
                tone="vault"
                animate
                reports={state === 'matched' ? REPORT_THRESHOLD : 1}
                reportsNeeded={REPORT_THRESHOLD}
              />
            )}

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-vault-raised pt-6 text-[14px] sm:grid-cols-4">
              <div>
                <dt className="text-[12px] text-vault-muted">Report ID</dt>
                <dd className="mt-0.5 font-mono text-[15px]">{receipt.reportId}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-vault-muted">Sealed</dt>
                <dd className="tabular mt-0.5">{formatDateTime(receipt.sealedAt)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-vault-muted">Ciphertext</dt>
                <dd className="tabular mt-0.5">
                  {formatBytes(receipt.sealedBytes)}
                  {receipt.attachmentCount > 0 && `, ${receipt.attachmentCount} file${receipt.attachmentCount === 1 ? '' : 's'}`}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-vault-muted">Deleted if unmatched</dt>
                <dd className="tabular mt-0.5">{formatDate(receipt.expiresAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-vault-raised px-6 py-4 sm:flex-row sm:items-center sm:px-8 lg:px-10">
          <p className="flex-1 text-[13px] text-vault-muted">
            {gone
              ? 'You can close this page. There is nothing left to protect.'
              : `Write down ${receipt.reportId} and keep your passphrase. You need both to withdraw later, from any device.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {state === 'waiting' && (
              <Button variant="danger" onClick={destroy} disabled={busy}>
                <Trash2 aria-hidden />
                {busy ? 'Destroying…' : 'Withdraw and destroy report'}
              </Button>
            )}
            {state === 'matched' && (
              <Button variant="vault" onClick={destroy} disabled={busy}>
                {busy ? 'Removing…' : 'Remove my contact details'}
              </Button>
            )}
            <Button variant="vault" onClick={() => void refresh()}>
              Check status
            </Button>
            <Button variant="vault" onClick={onNew}>
              File another report
            </Button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-[14px] text-danger-ink">{error}</p>}
    </div>
  )
}

/** The escrow box: a padlock whose shackle drops shut when the report is sealed. */
function VaultGraphic({ state }: { state: VaultState }) {
  const gone = state === 'withdrawn' || state === 'gone'
  const open = false
  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-40 lg:w-full" role="img" aria-label={gone ? 'Empty vault' : open ? 'Vault opened' : 'Sealed vault'}>
      <rect x="20" y="20" width="180" height="180" rx="22" fill="#1b2538" />
      <rect x="20" y="20" width="180" height="180" rx="22" fill="none" stroke="#2a364d" strokeWidth="2" />
      <g className={open ? undefined : 'anim-shackle'} style={{ transform: open ? 'translateY(-18px)' : undefined, transition: 'transform 600ms cubic-bezier(0.34,1.4,0.64,1)' }}>
        <path
          d="M80 104V82a30 30 0 0 1 60 0v22"
          fill="none"
          stroke={gone ? '#475569' : '#94a3b8'}
          strokeWidth="12"
          strokeLinecap="round"
        />
      </g>
      <rect x="62" y="100" width="96" height="76" rx="12" fill={gone ? '#334155' : '#e2e8f0'} />
      {!gone && (
        <>
          <circle cx="110" cy="132" r="9" fill={open ? '#10b981' : '#0f172a'} />
          <path d="M106 138h8l2.5 20h-13z" fill={open ? '#10b981' : '#0f172a'} />
        </>
      )}
    </svg>
  )
}
