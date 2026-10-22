/** Thin wrappers over WebCrypto. Every primitive the simulation uses is real. */
import { toHex, type Bytes } from './bytes'

const AES = 'AES-GCM'

async function aesKey(raw: Bytes): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error('AES key must be 32 bytes')
  return crypto.subtle.importKey('raw', raw, AES, false, ['encrypt', 'decrypt'])
}

export interface Sealed {
  iv: Bytes
  ciphertext: Bytes
}

/** AES-256-GCM. `aad` binds the ciphertext to its record id, so it cannot be moved to another row. */
export async function seal(rawKey: Bytes, plaintext: Bytes, aad: Bytes): Promise<Sealed> {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const key = await aesKey(rawKey)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: AES, iv, additionalData: aad }, key, plaintext),
  )
  return { iv, ciphertext }
}

/** Throws if the key is wrong or the ciphertext was altered. */
export async function open(rawKey: Bytes, sealed: Sealed, aad: Bytes): Promise<Bytes> {
  const key = await aesKey(rawKey)
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: AES, iv: sealed.iv, additionalData: aad },
      key,
      sealed.ciphertext,
    ),
  )
}

export async function sha256(data: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

export async function hmacSha256(rawKey: Bytes, data: Bytes): Promise<Bytes> {
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
}

export const PASSPHRASE_ITERATIONS = 210_000

/**
 * Stretches a withdrawal passphrase with PBKDF2-SHA-256. The result is the proof a reporter
 * presents to withdraw; the nodes store only SHA-256 of it, so a copy of their records is not
 * enough to withdraw, and a guessed passphrase costs 210,000 hashes to test.
 */
export async function passphraseProof(passphrase: string, salt: Bytes): Promise<Bytes> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSPHRASE_ITERATIONS },
    material,
    256,
  )
  return new Uint8Array(bits)
}

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const
const ECDSA_SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const

export async function generateSigningKeys(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDSA, false, ['sign', 'verify'])
}

export async function sign(privateKey: CryptoKey, message: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.sign(ECDSA_SIGN, privateKey, message))
}

/** Returns false for a bad signature, a malformed one, or a key of the wrong kind. */
export async function verify(publicKey: CryptoKey, signature: Bytes, message: Bytes): Promise<boolean> {
  try {
    return await crypto.subtle.verify(ECDSA_SIGN, publicKey, signature, message)
  } catch {
    return false
  }
}

/** First 8 bytes of SHA-256 over the SPKI encoding: enough to tell keys apart on screen. */
export async function fingerprint(publicKey: CryptoKey): Promise<string> {
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', publicKey))
  return toHex((await sha256(spki)).slice(0, 8))
}
