/** Byte helpers shared by the escrow engine. Everything here is pure and synchronous. */

export type Bytes = Uint8Array<ArrayBuffer>

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function utf8(text: string): Bytes {
  return encoder.encode(text)
}

export function fromUtf8(bytes: Bytes): string {
  return decoder.decode(bytes)
}

export function randomBytes(length: number): Bytes {
  const out = new Uint8Array(length)
  crypto.getRandomValues(out)
  return out
}

export function toHex(bytes: Bytes): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function fromHex(hex: string): Bytes {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error('Invalid hex string')
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/** Compares without an early exit, so timing does not reveal where two values differ. */
export function equalBytes(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** A short, human-readable id such as "R-3F2A". */
export function shortId(prefix: string): string {
  return `${prefix}-${toHex(randomBytes(2)).toUpperCase()}`
}

export function fromBase64(text: string): Bytes {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}
