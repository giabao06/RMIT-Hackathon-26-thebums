/**
 * Shamir secret sharing over GF(256) (the AES field, polynomial 0x11b). Each byte of the secret is
 * the constant term of its own random polynomial of degree threshold-1; a share is the polynomial
 * evaluated at one non-zero x. Any `threshold` shares rebuild the secret, fewer reveal nothing.
 */
import { randomBytes, type Bytes } from './bytes'

export interface Share {
  x: number
  y: Bytes
}

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let v = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = v
    LOG[v] = i
    v ^= (v << 1) ^ (v & 0x80 ? 0x11b : 0) // multiply by the generator 3
    v &= 0xff
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])
const div = (a: number, b: number) => (a === 0 ? 0 : EXP[LOG[a] + 255 - LOG[b]])

/** Splits `secret` into `count` shares, any `threshold` of which rebuild it. */
export function split(secret: Bytes, count: number, threshold: number): Share[] {
  if (!Number.isInteger(threshold) || threshold < 2 || count < threshold || count > 255) {
    throw new Error('Need 2 <= threshold <= count <= 255')
  }
  const shares: Share[] = Array.from({ length: count }, (_, i) => ({ x: i + 1, y: new Uint8Array(secret.length) }))
  for (let b = 0; b < secret.length; b++) {
    const coeffs = randomBytes(threshold - 1) // random higher-order terms
    for (const share of shares) {
      let y = 0
      for (let k = coeffs.length - 1; k >= 0; k--) y = mul(y, share.x) ^ coeffs[k] // Horner
      share.y[b] = mul(y, share.x) ^ secret[b]
    }
  }
  return shares
}

/** Rebuilds the secret from at least `threshold` distinct shares (Lagrange interpolation at x = 0). */
export function combine(shares: Share[]): Bytes {
  if (shares.length < 2) throw new Error('Need at least two shares')
  const xs = shares.map((s) => s.x)
  if (new Set(xs).size !== xs.length || xs.some((x) => x < 1 || x > 255)) throw new Error('Shares must have distinct non-zero x')
  const length = shares[0].y.length
  if (shares.some((s) => s.y.length !== length)) throw new Error('Shares differ in length')

  const out = new Uint8Array(length)
  for (let i = 0; i < shares.length; i++) {
    let weight = 1
    for (let j = 0; j < shares.length; j++) {
      if (i !== j) weight = mul(weight, div(shares[j].x, shares[i].x ^ shares[j].x))
    }
    for (let b = 0; b < length; b++) out[b] ^= mul(shares[i].y[b], weight)
  }
  return out
}

/** x followed by y, for wrapping and transport. */
export const shareToBytes = (s: Share): Bytes => new Uint8Array([s.x, ...s.y])
export const shareFromBytes = (b: Bytes): Share => ({ x: b[0], y: b.slice(1) })
