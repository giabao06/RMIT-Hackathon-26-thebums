/**
 * Bridge to Tide policy-governed VVK encryption (IAMService.doEncrypt/doDecrypt). The Tide SDK is
 * a hook, so TideConnected registers it here and the escrow code stays free of React.
 * The policy is the signed ReportRelease contract (contracts/ReportRelease.cs), base64 in
 * VITE_TIDE_RELEASE_POLICY. Without it the reports stay on the simulation path.
 */
import { utf8, fromUtf8, type Bytes } from './bytes'

type Crypt = (data: unknown, policy?: Uint8Array) => Promise<unknown>
let impl: { encrypt: Crypt; decrypt: Crypt } | null = null

export const REPORT_TAG = 'safethreshold-report'

export function registerTideCrypto(next: typeof impl): void {
  impl = next
}

function policy(): Uint8Array | null {
  const b64 = import.meta.env.VITE_TIDE_RELEASE_POLICY as string | undefined
  return b64 ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : null
}

/** True when a Tide session and the deployed release policy are both available. */
export const tideSealAvailable = (): boolean => impl !== null && policy() !== null

export async function tideEncrypt(plaintext: string): Promise<Bytes> {
  const p = policy()
  if (!impl || !p) throw new Error('Tide encryption is not available.')
  const [out] = (await impl.encrypt([{ data: plaintext, tags: [REPORT_TAG] }], p)) as unknown[]
  if (typeof out !== 'string') throw new Error('Unexpected Tide ciphertext.')
  return utf8(out)
}

export async function tideDecrypt(ciphertext: Bytes): Promise<string> {
  const p = policy()
  if (!impl || !p) throw new Error('Tide decryption is not available.')
  const [out] = (await impl.decrypt([{ encrypted: fromUtf8(ciphertext), tags: [REPORT_TAG] }], p)) as unknown[]
  if (typeof out !== 'string') throw new Error('Unexpected Tide plaintext.')
  return out
}
