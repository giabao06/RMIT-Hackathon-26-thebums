import { fromBase64, type Bytes } from './bytes'
import { tideDecrypt, tideSealAvailable } from './tideCrypto'
import type { OpenedReport } from './types'

export class PolicyPending extends Error {
  constructor(reportId: string) {
    super(`Report ${reportId} stays sealed until the Tide release policy is deployed.`)
  }
}

/**
 * The one place the investigator's device turns a sealed bundle into a report: policy-governed
 * VVK decryption (doDecrypt + the signed Forseti policy). The nodes release only after the steward
 * quorum; no key is held or rebuilt here (I-01).
 */
export async function decryptReport(sealed: { id: string; sealedAt: string; ciphertext: string; contact?: string | null }): Promise<OpenedReport> {
  if (!tideSealAvailable()) throw new PolicyPending(sealed.id)
  const body = JSON.parse(await tideDecrypt(fromBase64(sealed.ciphertext))) as {
    body: { incidentDate: string; content: OpenedReport['content']; attachments: { name: string; type: string }[] }
    files: string[]
  }
  return {
    reportId: sealed.id,
    sealedAt: Date.parse(sealed.sealedAt),
    incidentDate: body.body.incidentDate,
    content: body.body.content,
    attachments: body.body.attachments.map((a, i): OpenedReport['attachments'][number] => ({
      name: a.name,
      type: a.type,
      data: fromBase64(body.files[i] ?? '') as Bytes,
    })),
    contact: sealed.contact ? await tideDecrypt(fromBase64(sealed.contact)) : null,
  }
}
