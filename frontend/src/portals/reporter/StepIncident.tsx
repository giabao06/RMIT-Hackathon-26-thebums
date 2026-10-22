import { useRef, useState, type DragEvent } from 'react'
import { FileUp, ShieldCheck, X } from 'lucide-react'
import { cn } from 'cn'
import { RichEditor } from '@/components/rich/RichEditor'
import { Field, SettingsRow } from '@/components/SettingsRow'
import { Input } from '@/components/ui/input'
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, formatBytes } from '@/escrow/simulation'
import type { Draft } from './draft'
import { LiveCipher } from './LiveCipher'

export function StepIncident({
  draft,
  update,
  editorKey,
  today,
}: {
  draft: Draft
  update: (patch: Partial<Draft>) => void
  editorKey: number
  today: string
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = [...list]
    const tooBig = incoming.filter((f) => f.size > MAX_ATTACHMENT_BYTES)
    const accepted = incoming.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)
    const room = MAX_ATTACHMENTS - draft.files.length
    const errors: string[] = []
    if (tooBig.length) errors.push(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} over 5 MB.`)
    if (accepted.length > room) errors.push(`Only ${MAX_ATTACHMENTS} files fit; the rest were left out.`)
    setFileError(errors.length ? errors.join(' ') : null)
    update({ files: [...draft.files, ...accepted.slice(0, Math.max(room, 0))] })
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  return (
    <SettingsRow
      title="What happened?"
      description="Write it in your own words. Dates, places and what was said help an investigator most. Nothing here is saved until you seal it."
      aside={
        <div className="rounded-[12px] bg-vault p-4 text-vault-ink">
          <div className="flex items-center gap-2 text-[14px] font-medium">
            <ShieldCheck className="size-4 text-active" strokeWidth={2} aria-hidden />
            Client-side encrypted
            <span className="ml-auto flex items-center gap-1.5 text-[12px] font-normal text-vault-muted">
              <span className="size-1.5 rounded-full bg-active" aria-hidden />
              live
            </span>
          </div>
          <p className="mt-1 text-[13px] text-vault-muted">No admin, server or AI can read this.</p>
          <div className="mt-3 rounded-[8px] bg-vault-raised p-3">
            <LiveCipher text={draft.text} tone="vault" />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="When did it happen?" htmlFor="incident-date" hint="The first or the main time. Put other dates in the description.">
          <Input
            id="incident-date"
            type="date"
            max={today}
            value={draft.incidentDate}
            onChange={(e) => update({ incidentDate: e.target.value })}
            className="h-10 w-full bg-white sm:w-56"
          />
        </Field>

        <Field label="Description" htmlFor="incident-text">
          <RichEditor
            key={editorKey}
            id="incident-text"
            value={draft.content}
            onChange={(content, text) => update({ content, text })}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-medium" id="evidence-label">
            Evidence <span className="font-normal text-slate">(optional)</span>
          </span>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-[#c5cfdb] bg-white px-4 py-3.5 transition-colors hover:border-ink',
              dragging && 'border-active-ink bg-active-soft',
              draft.files.length >= MAX_ATTACHMENTS && 'pointer-events-none opacity-50',
            )}
          >
            <FileUp className="size-5 shrink-0 text-slate" strokeWidth={1.75} aria-hidden />
            <span className="text-[14px]">
              Drop screenshots, messages or PDFs here, or <span className="font-medium underline underline-offset-2">choose files</span>
              <span className="block text-[13px] text-slate">
                Up to {MAX_ATTACHMENTS} files, 5 MB each. Encrypted with the report; file names too.
              </span>
            </span>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              aria-labelledby="evidence-label"
              disabled={draft.files.length >= MAX_ATTACHMENTS}
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {fileError && <p role="alert" className="text-[13px] text-danger-ink">{fileError}</p>}
          {draft.files.length > 0 && (
            <ul className="flex flex-col">
              {draft.files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center gap-3 border-b border-rule py-2 last:border-0">
                  <span className="min-w-0 flex-1 truncate text-[14px]">{file.name}</span>
                  <span className="tabular text-[13px] text-slate">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => update({ files: draft.files.filter((_, j) => j !== i) })}
                    className="grid size-7 place-items-center rounded-md text-slate hover:bg-white hover:text-ink"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SettingsRow>
  )
}
