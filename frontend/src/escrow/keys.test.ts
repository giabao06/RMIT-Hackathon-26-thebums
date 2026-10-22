import { describe, expect, it } from 'vitest'
import { utf8 } from './bytes'
import { createStaffKey, restoreStaffKey, unwrap, wrapTo } from './keys'

describe('staff keys', () => {
  it('wraps to a public key and only its owner unwraps', async () => {
    const owner = await createStaffKey('correct horse battery')
    const other = await createStaffKey('another passphrase')
    const blob = await wrapTo(owner.key.publicKey, utf8('a share'), utf8('aad'))
    expect(await unwrap(owner.key.privateKey, blob, utf8('aad'))).toEqual(utf8('a share'))
    await expect(unwrap(other.key.privateKey, blob, utf8('aad'))).rejects.toThrow()
    await expect(unwrap(owner.key.privateKey, blob, utf8('other aad'))).rejects.toThrow()
  })

  it('restores the private key from the passphrase-wrapped backup', async () => {
    const { key, backup } = await createStaffKey('correct horse battery')
    const restored = await restoreStaffKey(backup, key.publicKey, 'correct horse battery')
    const blob = await wrapTo(key.publicKey, utf8('x'), utf8('a'))
    expect(await unwrap(restored.privateKey, blob, utf8('a'))).toEqual(utf8('x'))
    await expect(restoreStaffKey(backup, key.publicKey, 'wrong passphrase')).rejects.toThrow()
  })
})
