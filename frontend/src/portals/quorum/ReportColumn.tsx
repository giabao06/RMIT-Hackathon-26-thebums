import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { RichViewer } from '@/components/rich/RichViewer'
import { formatBytes, type OpenedReport } from '@/escrow/simulation'
import { formatDateTime, formatIsoDate } from '@/lib/format'

export function ReportColumn({ report, label }: { report: OpenedReport; label: string }) {
  return (
    <article className="flex min-w-0 flex-col rounded-[12px] border border-rule bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-rule px-5 py-4">
        <h3 className="text-[15px] font-semibold">{label}</h3>
        <span className="font-mono text-[13px] text-slate">{report.reportId}</span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 pt-4 text-[13px]">
        <dt className="text-slate">Incident</dt>
        <dt className="text-slate">Sealed</dt>
        <dd className="tabular text-[14px] font-medium">{formatIsoDate(report.incidentDate)}</dd>
        <dd className="tabular text-[14px]">{formatDateTime(report.sealedAt)}</dd>
      </dl>
      <div className="px-5 pt-4 pb-5">
        <RichViewer doc={report.content} />
      </div>
      <div className="mt-auto border-t border-rule px-5 py-4 text-[14px]">
        <div className="text-[13px] text-slate">Evidence</div>
        {report.attachments.length === 0 ? (
          <p className="mt-1 text-slate">None attached.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {report.attachments.map((file, i) => (
              <Attachment key={`${file.name}-${i}`} file={file} />
            ))}
          </ul>
        )}
        <div className="mt-4 text-[13px] text-slate">Contact</div>
        <p className="mt-1">{report.contact ?? <span className="text-slate">The reporter chose to stay anonymous.</span>}</p>
      </div>
    </article>
  )
}

function Attachment({ file }: { file: OpenedReport['attachments'][number] }) {
  const [url, setUrl] = useState<string | null>(null)
  const isImage = /^image\/(png|jpe?g|gif|webp)$/.test(file.type)

  // A data URL rather than an object URL: nothing to revoke, so StrictMode's double effects
  // cannot leave a revoked link on screen. Files are capped at 5 MB.
  useEffect(() => {
    let cancelled = false
    const reader = new FileReader()
    reader.onload = () => {
      if (!cancelled && typeof reader.result === 'string') setUrl(reader.result)
    }
    reader.readAsDataURL(new Blob([file.data], { type: file.type || 'application/octet-stream' }))
    return () => {
      cancelled = true
      reader.abort()
    }
  }, [file])

  return (
    <li className="flex flex-col gap-2">
      {isImage && url && <img src={url} alt={`Evidence: ${file.name}`} className="max-h-48 w-auto self-start rounded-[8px] border border-rule object-contain" />}
      <div className="flex items-center gap-2">
        <FileText className="size-4 shrink-0 text-slate" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        <span className="tabular text-[13px] text-slate">{formatBytes(file.data.length)}</span>
        {url && (
          <a href={url} download={file.name} className="grid size-7 place-items-center rounded-md text-slate hover:bg-panel hover:text-ink" aria-label={`Download ${file.name}`}>
            <Download className="size-4" aria-hidden />
          </a>
        )}
      </div>
    </li>
  )
}
