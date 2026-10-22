import { useState } from 'react'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import { useWorld } from '@/app/worldContext'
import { Button } from '@/components/ui/button'
import { plainText } from '@/escrow/richDoc'
import { SAMPLE_REPORTS } from '@/escrow/samples'
import { MIN_PASSPHRASE_LENGTH } from '@/escrow/simulation'
import { canonicalSubject } from '@/escrow/subject'
import { draftFromSample, emptyDraft, type Draft } from './draft'
import { SealedVault } from './SealedVault'
import { StepEscrow } from './StepEscrow'
import { StepIncident } from './StepIncident'
import { StepTarget } from './StepTarget'
import { Stepper } from './Stepper'
import { useReporterState } from './reporterState'
import { WithdrawEarlier } from './WithdrawEarlier'

function isoToday(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns an error to show, or null when the step is complete. */
function checkStep(step: number, draft: Draft, today: string): string | null {
  if (step === 0) {
    try {
      canonicalSubject(draft.subject)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  if (step === 1) {
    if (!draft.incidentDate) return 'Add the date it happened, or your best guess.'
    if (draft.incidentDate > today) return 'The date cannot be in the future.'
    if (!plainText(draft.content).trim()) return 'Describe what happened.'
    return null
  }
  if (draft.passphrase.length < MIN_PASSPHRASE_LENGTH) return `Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`
  if (draft.passphrase !== draft.confirm) return 'The two passphrases differ.'
  return null
}

export function ReporterPortal() {
  const { world, snapshot } = useWorld()
  const { state, setState } = useReporterState()
  const { session, step, draft, editorKey, sealed } = state
  const [error, setError] = useState<string | null>(null)
  const [sealing, setSealing] = useState(false)
  const setStep = (next: number) => setState((s) => ({ ...s, step: next }))
  const today = isoToday(snapshot.now)

  const update = (patch: Partial<Draft>) => {
    setState((s) => ({ ...s, draft: { ...s.draft, ...patch } }))
    setError(null)
  }

  function fillSample(i: 0 | 1) {
    setState((s) => ({ ...s, draft: draftFromSample(SAMPLE_REPORTS[i]), editorKey: s.editorKey + 1, step: 0 }))
    setError(null)
  }

  function next() {
    const problem = checkStep(step, draft, today)
    if (problem) return setError(problem)
    setStep(step + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function seal() {
    const problem = checkStep(2, draft, today)
    if (problem) return setError(problem)
    setSealing(true)
    try {
      const attachments = await Promise.all(
        draft.files.map(async (file) => ({
          name: file.name,
          type: file.type || 'application/octet-stream',
          data: new Uint8Array(await file.arrayBuffer()),
        })),
      )
      const receipt = await world.submitReport(session, {
        subject: draft.subject,
        incidentDate: draft.incidentDate,
        content: draft.content,
        attachments,
        contact: draft.contact,
        lifespanMonths: draft.lifespanMonths,
        passphrase: draft.passphrase,
      })
      setState((s) => ({
        ...s,
        sealed: { receipt, passphrase: s.draft.passphrase },
        draft: emptyDraft(),
        editorKey: s.editorKey + 1,
        step: 0,
      }))
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSealing(false)
    }
  }

  function startOver() {
    setState((s) => ({
      session: world.newReporterSession(), // a new, independent reporter
      step: 0,
      draft: emptyDraft(),
      editorKey: s.editorKey + 1,
      sealed: null,
    }))
  }

  if (sealed) {
    return (
      <div className="flex flex-col gap-12">
        <SealedVault receipt={sealed.receipt} passphrase={sealed.passphrase} onNew={startOver} />
        <div className="mx-auto w-full max-w-[1152px]">
          <WithdrawEarlier />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1152px] flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] leading-tight font-semibold">Report misconduct</h1>
          <p className="mt-1 max-w-[62ch] text-[14px] text-slate">
            Your report is encrypted on this device and stays sealed until someone else, independently, reports the
            same person. Press Esc at any time to leave this page instantly.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[13px] text-slate">
          <span className="mr-1">Demo:</span>
          <button type="button" onClick={() => fillSample(0)} className="rounded-md px-2 py-1 font-medium text-ink hover:bg-panel">
            first student
          </button>
          <button type="button" onClick={() => fillSample(1)} className="rounded-md px-2 py-1 font-medium text-ink hover:bg-panel">
            second student
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Stepper current={step} onSelect={setStep} />
      </div>

      <div className="mt-8" key={step}>
        <div className="anim-fade-up">
          {step === 0 && <StepTarget draft={draft} update={update} />}
          {step === 1 && <StepIncident draft={draft} update={update} editorKey={editorKey} today={today} />}
          {step === 2 && <StepEscrow draft={draft} update={update} now={snapshot.now} />}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end lg:pl-[420px]">
        {error && (
          <p role="alert" className="text-[14px] text-danger-ink sm:mr-auto">
            {error}
          </p>
        )}
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={sealing}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button onClick={next}>
            Continue
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button onClick={seal} disabled={sealing}>
            <Lock aria-hidden />
            {sealing ? 'Encrypting and sealing…' : 'Seal report'}
          </Button>
        )}
      </div>

      <hr className="my-12 border-rule" />
      <WithdrawEarlier />
    </div>
  )
}
