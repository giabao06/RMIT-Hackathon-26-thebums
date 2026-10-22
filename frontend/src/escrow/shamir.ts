/**
 * Shamir secret sharing over GF(256), byte by byte.
 *
 * A report's data key is split into `n` shares so that any `t` of them rebuild it and
 * fewer than `t` reveal nothing about it. In the simulation each share goes to one node
 * of the network; no single node, and no server, ever holds the whole key.
 */
import { randomBytes, type Bytes } from './bytes'

export interface Share {
  /** The evaluation point, 1..255. Never 0: the secret lives at x = 0. */
  x: number
  y: Bytes
}

// Log and antilog tables for GF(2^8) with the AES polynomial x^8 + x^4 + x^3 + x + 1,
// generator 3.
const EXP = new Uint8Array(510)
const LOG = new Uint8Array(256)
{
  let value = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = value
    LOG[value] = i
    // multiply by 3: value * 2 (xtime) xor value
    const doubled = ((value << 1) ^ (value & 0x80 ? 0x1b : 0)) & 0xff
    value = doubled ^ value
  }
  for (let i = 255; i < 510; i++) EXP[i] = EXP[i - 255]
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

function div(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF(256)')
  if (a === 0) return 0
  return EXP[(LOG[a] + 255 - LOG[b]) % 255]
}

export function split(secret: Bytes, n: number, t: number): Share[] {
  if (!Number.isInteger(n) || !Number.isInteger(t)) throw new Error('n and t must be integers')
  if (t < 2) throw new Error('Threshold must be at least 2')
  if (t > n) throw new Error('Threshold cannot exceed the number of shares')
  if (n > 255) throw new Error('At most 255 shares')

  const shares: Share[] = Array.from({ length: n }, (_, i) => ({
    x: i + 1,
    y: new Uint8Array(secret.length),
  }))

  for (let byte = 0; byte < secret.length; byte++) {
    // Polynomial of degree t-1 whose constant term is the secret byte.
    const coefficients = new Uint8Array(t)
    coefficients[0] = secret[byte]
    coefficients.set(randomBytes(t - 1), 1)

    for (const share of shares) {
      // Horner's rule, highest coefficient first.
      let acc = 0
      for (let c = t - 1; c >= 0; c--) acc = mul(acc, share.x) ^ coefficients[c]
      share.y[byte] = acc
    }
  }
  return shares
}

/**
 * Rebuilds the secret by Lagrange interpolation at x = 0.
 * Given fewer shares than the threshold it returns an unrelated value, not an error:
 * the shares alone cannot tell how many were required.
 */
export function combine(shares: readonly Share[]): Bytes {
  if (shares.length < 2) throw new Error('Need at least two shares')
  const length = shares[0].y.length
  const xs = new Set<number>()
  for (const share of shares) {
    if (share.x < 1 || share.x > 255) throw new Error('Share has an invalid x')
    if (xs.has(share.x)) throw new Error('Duplicate share')
    if (share.y.length !== length) throw new Error('Shares have different lengths')
    xs.add(share.x)
  }

  const secret = new Uint8Array(length)
  for (let j = 0; j < shares.length; j++) {
    // Basis polynomial l_j evaluated at 0: product of x_m / (x_m - x_j); minus is xor here.
    let basis = 1
    for (let m = 0; m < shares.length; m++) {
      if (m === j) continue
      basis = mul(basis, div(shares[m].x, shares[m].x ^ shares[j].x))
    }
    for (let byte = 0; byte < length; byte++) {
      secret[byte] ^= mul(shares[j].y[byte], basis)
    }
  }
  return secret
}
