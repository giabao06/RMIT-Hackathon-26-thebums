import { describe, expect, it } from 'vitest'
import { SubjectError, canonicalSubject, normaliseName } from './subject'

describe('subject normalisation', () => {
  it('matches the same person typed two ways', () => {
    const a = canonicalSubject({ identifier: 'E39417', name: 'Ellis Varga', unit: 'School of Science' })
    const b = canonicalSubject({ identifier: 'e-39417', name: 'Dr Varga, Ellis', unit: 'school  of science' })
    expect(a).toBe(b)
  })

  it('folds Vietnamese diacritics and đ, and drops titles', () => {
    expect(normaliseName('PGS. TS. Nguyễn Văn Đức')).toBe(normaliseName('nguyen van duc'))
  })

  it('keeps Tiến, a given name, rather than treating it as a title', () => {
    expect(normaliseName('Trần Tiến')).toBe('tien tran')
  })

  it('keeps different people apart', () => {
    const a = canonicalSubject({ identifier: 'E39417', name: 'Ellis Varga', unit: 'Science' })
    const b = canonicalSubject({ identifier: 'E39418', name: 'Ellis Varga', unit: 'Science' })
    const c = canonicalSubject({ identifier: 'E39417', name: 'Ellis Varga', unit: 'Design' })
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('requires all three fields', () => {
    expect(() => canonicalSubject({ identifier: '', name: 'Ellis Varga', unit: 'Science' })).toThrow(SubjectError)
    expect(() => canonicalSubject({ identifier: 'E1', name: 'Dr.', unit: 'Science' })).toThrow(SubjectError)
  })
})
