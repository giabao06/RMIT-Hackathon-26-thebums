/**
 * The reporter's calls to the backend (backend/src/routes/reports.ts). Reports are sealed through
 * Tide's policy-governed encryption (tideCrypto.ts) before leaving the device; there is no local
 * fallback, because a report sealed with a key nobody holds could never be opened or matched.
 */
import { toHex, utf8, type Bytes } from './bytes'
import { passphraseProof, sha256 } from './crypto'
import { canonicalSubject } from './subject'
import { plainText } from './richDoc'
import { tideEncrypt, tideSealAvailable } from './tideCrypto'
import {
  InputError,
  LIFESPAN_OPTIONS,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MIN_PASSPHRASE_LENGTH,
  type Receipt,
  type ReportInput,
} from './types'

const API_URL = import.meta.env.VITE_API_URL as string | undefined
const ORG_ID = import.meta.env.VITE_ORG_ID as string | undefined

// shortcut: one fixed salt, because the API keeps no per-report salt; 210k PBKDF2 rounds still
// slow guessing. Upgrade by storing a salt beside withdraw_hash.
const SALT = utf8('safethreshold:withdraw:v1')
const proofBytes = (passphrase: string) => passphraseProof(passphrase, SALT)
const proofOf = async (passphrase: string) => toHex(await proofBytes(passphrase))

function base64(bytes: Bytes): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function endpoint(path: string): string {
  if (!API_URL || !ORG_ID) throw new InputError('This build has no backend configured (VITE_API_URL and VITE_ORG_ID).')
  return `${API_URL}${path}`
}

const post = (url: string, method: string, body: unknown) =>
  fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export async function submitReport(input: ReportInput): Promise<Receipt> {
  canonicalSubject(input.subject) // throws SubjectError on missing fields
  if (!plainText(input.content).trim()) throw new InputError('Describe what happened.')
  if (!(LIFESPAN_OPTIONS as readonly number[]).includes(input.lifespanMonths)) throw new InputError('Choose a lifespan of 12, 15 or 18 months.')
  if (input.passphrase.length < MIN_PASSPHRASE_LENGTH) throw new InputError(`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`)
  if (input.attachments.length > MAX_ATTACHMENTS) throw new InputError(`Attach at most ${MAX_ATTACHMENTS} files.`)
  if (input.attachments.some((a) => a.data.length > MAX_ATTACHMENT_BYTES)) throw new InputError('Each file must be 5 MB or smaller.')
  if (!tideSealAvailable()) {
    throw new InputError('Encryption needs a Tide session and the release policy. Sign in with Tide and check VITE_TIDE_RELEASE_POLICY.')
  }

  const url = endpoint('/reports')
  const body = {
    incidentDate: input.incidentDate,
    content: input.content,
    attachments: input.attachments.map((a) => ({ name: a.name, type: a.type })),
  }
  const ciphertext = await tideEncrypt(JSON.stringify({ body, files: input.attachments.map((f) => base64(f.data)) }))
  const contactText = input.contact.trim()
  const contact = contactText ? await tideEncrypt(contactText) : null

  const res = await post(url, 'POST', {
    org: ORG_ID,
    subject: input.subject,
    ciphertext: base64(ciphertext),
    contact: contact ? base64(contact) : undefined,
    withdrawHash: toHex(await sha256(await proofBytes(input.passphrase))),
    lifespanMonths: input.lifespanMonths,
  })
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'The server rejected the report.')
  const row = (await res.json()) as { reportId: string; expiresAt: string }
  return {
    reportId: row.reportId,
    sealedBytes: ciphertext.length,
    attachmentCount: input.attachments.length,
    sealedAt: Date.now(),
    expiresAt: Date.parse(row.expiresAt),
    lifespanMonths: input.lifespanMonths,
  }
}

/** 'sealed' = waiting for a match; 'eligible' = past the threshold; 'gone' = withdrawn or expired. */
export async function reportStatus(reportId: string, passphrase: string): Promise<'sealed' | 'eligible' | 'gone'> {
  const res = await post(endpoint(`/reports/${reportId}/status`), 'POST', { proof: await proofOf(passphrase) })
  if (res.status === 404) return 'gone'
  if (!res.ok) throw new Error('Could not check the report.')
  return ((await res.json()) as { status: 'sealed' | 'eligible' }).status
}

/** 'deleted' = the whole report is gone; 'contact' = matched, so only contact details were removed. */
export async function withdrawReport(reportId: string, passphrase: string): Promise<'deleted' | 'contact'> {
  const res = await post(endpoint(`/reports/${reportId}`), 'DELETE', { proof: await proofOf(passphrase) })
  if (res.status === 204) return 'deleted'
  if (res.status === 200) return 'contact'
  if (res.status === 404) throw new InputError('No report matches that ID and passphrase.')
  throw new Error('The server could not process the withdrawal.')
}
