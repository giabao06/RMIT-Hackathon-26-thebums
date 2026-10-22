/**
 * Optional link to the real backend (backend/src/routes/reports.ts). The simulation still holds
 * the keys and key shares in the tab, standing in for the Tide nodes; the API stores only the
 * sealed ciphertext, the withdrawal hash and a matching token it derives itself.
 */
import { toHex, utf8, type Bytes } from './bytes'
import { passphraseProof, sha256, type Sealed } from './crypto'
import type { Subject } from './subject'
import { tideEncrypt, tideSealAvailable } from './tideCrypto'

export interface RemoteSubmit {
  subject: Subject
  report: Sealed
  contact: Sealed | null
  attachments: Sealed[]
  lifespanMonths: number
  passphrase: string
  /** Plaintext for the policy-governed Tide seal; used instead of the local bundle when available. */
  plain: { body: unknown; files: { data: Bytes }[]; contact: string | null }
}

export interface RemoteReports {
  submit(input: RemoteSubmit & { reportId: string }): Promise<void>
  /** 'refused' means the API does not know this id/passphrase pair. */
  withdraw(reportId: string, passphrase: string): Promise<'deleted' | 'contact' | 'refused'>
}

// shortcut: one fixed salt, because the API keeps no per-report salt; 210k PBKDF2 rounds still
// slow guessing. Upgrade by storing a salt beside withdraw_hash.
const SALT = utf8('safethreshold:withdraw:v1')

function base64(bytes: Bytes): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** iv + ciphertext as one blob. */
const blob = (s: Sealed): Bytes => new Uint8Array([...s.iv, ...s.ciphertext])

/** Length-prefixed parts, so attachments travel in the same opaque bundle as the report. */
function bundle(parts: Sealed[]): Bytes {
  const blobs = parts.map(blob)
  const out = new Uint8Array(4 + blobs.reduce((n, b) => n + 4 + b.length, 0))
  const view = new DataView(out.buffer)
  view.setUint32(0, blobs.length)
  let at = 4
  for (const b of blobs) {
    view.setUint32(at, b.length)
    out.set(b, at + 4)
    at += 4 + b.length
  }
  return out
}

export function createRemote(baseUrl: string, org: string): RemoteReports {
  const ids = new Map<string, string>() // simulation id -> API id; the tab is the only holder
  const proofOf = async (passphrase: string) => passphraseProof(passphrase, SALT)

  return {
    async submit({ reportId, subject, report, contact, attachments, lifespanMonths, passphrase, plain }) {
      const viaTide = tideSealAvailable()
      const ciphertext = viaTide
        ? await tideEncrypt(JSON.stringify({ body: plain.body, files: plain.files.map((f) => base64(f.data)) }))
        : bundle([report, ...attachments])
      const contactBlob = viaTide ? (plain.contact ? await tideEncrypt(plain.contact) : null) : contact ? blob(contact) : null
      const res = await fetch(`${baseUrl}/reports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          org,
          subject,
          ciphertext: base64(ciphertext),
          contact: contactBlob ? base64(contactBlob) : undefined,
          withdrawHash: toHex(await sha256(await proofOf(passphrase))),
          lifespanMonths,
        }),
      })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'The server rejected the report.')
      ids.set(reportId, ((await res.json()) as { reportId: string }).reportId)
    },

    async withdraw(reportId, passphrase) {
      const id = ids.get(reportId)
      if (!id) return 'refused'
      const res = await fetch(`${baseUrl}/reports/${id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proof: toHex(await proofOf(passphrase)) }),
      })
      if (res.status === 204) {
        ids.delete(reportId)
        return 'deleted'
      }
      if (res.status === 200) return 'contact'
      if (res.status === 404) return 'refused'
      throw new Error('The server could not process the withdrawal.')
    },
  }
}
