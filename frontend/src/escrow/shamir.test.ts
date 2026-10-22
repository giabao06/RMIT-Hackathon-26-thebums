import { describe, expect, it } from 'vitest'
import { equalBytes, randomBytes } from './bytes'
import { combine, split } from './shamir'

describe('shamir', () => {
  const secret = randomBytes(32)
  const shares = split(secret, 5, 3)

  it('rebuilds the secret from every set of three shares', () => {
    for (let a = 0; a < 5; a++)
      for (let b = a + 1; b < 5; b++)
        for (let c = b + 1; c < 5; c++) {
          expect(equalBytes(combine([shares[a], shares[b], shares[c]]), secret)).toBe(true)
        }
  })

  it('rebuilds it from all five', () => {
    expect(equalBytes(combine(shares), secret)).toBe(true)
  })

  it('does not rebuild it from two', () => {
    expect(equalBytes(combine([shares[0], shares[1]]), secret)).toBe(false)
  })

  it('rejects duplicate shares and impossible thresholds', () => {
    expect(() => combine([shares[0], shares[0]])).toThrow('Duplicate')
    expect(() => split(secret, 2, 3)).toThrow()
    expect(() => split(secret, 5, 1)).toThrow()
  })
})
