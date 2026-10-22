/**
 * Stewards and investigators each hold an ECDH P-256 key pair. Shares are wrapped to a public key
 * (ephemeral ECDH + HKDF + AES-256-GCM), so only the holder of the private key can read them. The
 * private key never leaves the browser except as a backup wrapped by the user's passphrase.
 */
import { utf8, type Bytes } from './bytes'
import { open, passphraseProof, seal } from './crypto'

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const
const INFO = utf8('safethreshold:wrap:v1')
const PUB = 65 // uncompressed P-256 point
const IV = 12

export interface StaffKey {
  privateKey: CryptoKey // non-extractable
  publicKey: Bytes // raw, what the server stores
}

const join = (...parts: Bytes[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function importPrivate(pkcs8: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', pkcs8, ECDH, false, ['deriveBits'])
}

async function wrapKey(passphrase: string, salt: Bytes): Promise<Bytes> {
  return passphraseProof(passphrase, salt) // 32 bytes from PBKDF2, used as an AES-256 key
}

/** Creates a key pair and the passphrase-wrapped backup to store on the server. */
export async function createStaffKey(passphrase: string): Promise<{ key: StaffKey; backup: Bytes }> {
  const pair = await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const sealed = await seal(await wrapKey(passphrase, salt), pkcs8, utf8('backup'))
  pkcs8.fill(0)
  const key = { privateKey: await importPrivate(new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))), publicKey }
  return { key, backup: join(salt, sealed.iv, sealed.ciphertext) }
}

/** Restores a key on a new device. Throws if the passphrase is wrong. */
export async function restoreStaffKey(backup: Bytes, publicKey: Bytes, passphrase: string): Promise<StaffKey> {
  const salt = backup.slice(0, 16)
  const iv = backup.slice(16, 16 + IV)
  const ciphertext = backup.slice(16 + IV)
  const pkcs8 = await open(await wrapKey(passphrase, salt), { iv, ciphertext }, utf8('backup'))
  const privateKey = await importPrivate(pkcs8)
  pkcs8.fill(0)
  return { privateKey, publicKey }
}

/** Wraps `plaintext` so only the holder of `recipientPublic`'s private key can read it. `aad` binds it to its purpose. */
export async function wrapTo(recipientPublic: Bytes, plaintext: Bytes, aad: Bytes): Promise<Bytes> {
  const ephemeral = await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])
  const ephPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))
  const recipient = await crypto.subtle.importKey('raw', recipientPublic, ECDH, false, [])
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipient }, ephemeral.privateKey, 256)
  const aes = await hkdf(secret, ephPublic)
  const sealed = await seal(aes, plaintext, aad)
  aes.fill(0)
  return join(ephPublic, sealed.iv, sealed.ciphertext)
}

export async function unwrap(privateKey: CryptoKey, blob: Bytes, aad: Bytes): Promise<Bytes> {
  const ephPublic = blob.slice(0, PUB)
  const sender = await crypto.subtle.importKey('raw', ephPublic, ECDH, false, [])
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: sender }, privateKey, 256)
  const aes = await hkdf(secret, ephPublic)
  const plaintext = await open(aes, { iv: blob.slice(PUB, PUB + IV), ciphertext: blob.slice(PUB + IV) }, aad)
  aes.fill(0)
  return plaintext
}

async function hkdf(secret: ArrayBuffer, salt: Bytes): Promise<Bytes> {
  const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: INFO }, material, 256))
}
