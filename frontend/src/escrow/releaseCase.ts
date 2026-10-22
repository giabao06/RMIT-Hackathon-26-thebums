/**
 * The two device-side halves of a release. A steward re-wraps their shares to the assigned
 * investigator (approval), and the investigator combines them to open the reports. No whole key
 * exists anywhere but briefly in the investigator's memory.
 */
import { fromBase64, fromUtf8, utf8, type Bytes } from './bytes'
import { open } from './crypto'
import { unwrap, wrapTo, type StaffKey } from './keys'
import { combine, shareFromBytes } from './shamir'
import type { OpenedReport } from './types'

const b64 = (b: Bytes) => btoa(String.fromCharCode(...b))
const sealedFrom = (blob: Bytes) => ({ iv: blob.slice(0, 12), ciphertext: blob.slice(12) })

/** Steward: unwrap my share of each report and wrap it to the investigator. */
export async function rewrapForInvestigator(
  mine: StaffKey,
  stewardId: string,
  investigatorKey: string,
  shares: { report: string; share: string }[],
): Promise<{ report: string; share: string }[]> {
  return Promise.all(
    shares.map(async ({ report, share }) => {
      const plain = await unwrap(mine.privateKey, fromBase64(share), utf8(`share|${stewardId}`))
      const out = await wrapTo(fromBase64(investigatorKey), plain, utf8(`released|${report}`))
      plain.fill(0)
      return { report, share: b64(out) }
    }),
  )
}

interface SealedRow {
  id: string
  sealedAt: string
  ciphertext: string
  contact?: string | null
}

/** Investigator: unwrap the released shares per report, rebuild each key, decrypt. */
export async function openReports(
  mine: StaffKey,
  rows: SealedRow[],
  shares: { reportId: string; share: string }[],
): Promise<OpenedReport[]> {
  return Promise.all(
    rows.map(async (row) => {
      const parts = await Promise.all(
        shares.filter((s) => s.reportId === row.id).map(async (s) => shareFromBytes(await unwrap(mine.privateKey, fromBase64(s.share), utf8(`released|${row.id}`)))),
      )
      if (parts.length < 2) throw new Error('Not enough shares have been released for this report.')
      const key = combine(parts)
      try {
        const plain = JSON.parse(fromUtf8(await open(key, sealedFrom(fromBase64(row.ciphertext)), utf8('report')))) as {
          body: { incidentDate: string; content: OpenedReport['content']; attachments: { name: string; type: string }[] }
          files: string[]
        }
        return {
          reportId: row.id,
          sealedAt: Date.parse(row.sealedAt),
          incidentDate: plain.body.incidentDate,
          content: plain.body.content,
          attachments: plain.body.attachments.map((a, i) => ({ name: a.name, type: a.type, data: fromBase64(plain.files[i] ?? '') })),
          contact: row.contact ? fromUtf8(await open(key, sealedFrom(fromBase64(row.contact)), utf8('contact'))) : null,
        }
      } finally {
        key.fill(0)
      }
    }),
  )
}

