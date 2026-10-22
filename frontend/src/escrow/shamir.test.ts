import { describe, expect, it } from 'vitest'
import { randomBytes } from './bytes'
import { combine, shareFromBytes, shareToBytes, split } from './shamir'

describe('Shamir sharing', () => {
  const secret = randomBytes(32)

  it('rebuilds the secret from any threshold-sized subset', () => {
    const shares = split(secret, 5, 3)
    for (const pick of [[0, 1, 2], [4, 2, 0], [1, 3, 4]]) {
      expect(combine(pick.map((i) => shares[i]))).toEqual(secret)
    }
  })

  it('rebuilds from more shares than the threshold', () => {
    expect(combine(split(secret, 5, 3))).toEqual(secret)
  })

  it('does not rebuild from fewer than the threshold', () => {
    const shares = split(secret, 5, 3)
    expect(combine(shares.slice(0, 2))).not.toEqual(secret)
  })

  it('survives a round trip through bytes', () => {
    const shares = split(secret, 3, 2).map((s) => shareFromBytes(shareToBytes(s)))
    expect(combine(shares.slice(1))).toEqual(secret)
  })

  it('rejects bad parameters and duplicate shares', () => {
    expect(() => split(secret, 3, 1)).toThrow()
    expect(() => split(secret, 2, 3)).toThrow()
    const [a] = split(secret, 3, 2)
    expect(() => combine([a, a])).toThrow()
  })
})
